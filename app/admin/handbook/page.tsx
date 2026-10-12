"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  HANDBOOK_BUCKET,
  HANDBOOK_MAX_PAGES,
  editionLabel,
  formatEditionDate,
  type HandbookContentsEntry,
  type HandbookEditionView,
} from "@/lib/handbook-format";
import type { AccessLevel } from "@/lib/clan-access";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

const VISIBILITY_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "staff", label: "Staff only (Oak and above)" },
  { value: "clan_member", label: "Clan members" },
  { value: "verified_player", label: "Anyone with a verified RSN" },
  { value: "anonymous", label: "Anyone" },
];

type Edition = HandbookEditionView & { page_paths: string[]; pdf_path: string | null };

interface DraftPage {
  path: string;
  /** Signed link for saved pages, or a local blob: URL for ones just uploaded. */
  preview: string;
}

interface Draft {
  id: string | null;
  title: string;
  versionLabel: string;
  notes: string;
  visibility: AccessLevel;
  pages: DraftPage[];
  pdfPath: string | null;
  contents: { title: string; page: string }[];
  isPublished: boolean;
}

function emptyDraft(): Draft {
  return { id: null, title: "Staff Handbook", versionLabel: "", notes: "", visibility: "staff", pages: [], pdfPath: null, contents: [], isPublished: false };
}

function draftFrom(e: Edition): Draft {
  return {
    id: e.id,
    title: e.title,
    versionLabel: e.version_label ?? "",
    notes: e.notes ?? "",
    visibility: e.visibility,
    pages: e.page_paths.map((path, i) => ({ path, preview: e.page_urls[i] })),
    pdfPath: e.pdf_path,
    contents: e.contents.map((c) => ({ title: c.title, page: String(c.page) })),
    isPublished: e.is_published,
  };
}

/** Uploads one file to the private handbook bucket through a signed upload URL from the server. */
async function uploadFile(file: Blob, contentType: string): Promise<string> {
  const res = await fetch("/api/admin/handbook/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Couldn't start the upload.");
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(HANDBOOK_BUCKET).uploadToSignedUrl(data.path, data.token, file, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path as string;
}

export default function AdminHandbookPage() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/handbook");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setEditions(data.editions ?? []);
    else setError(data.error ?? "Failed to load the handbook.");
    setLoading(false);
  };

  useEffect(() => {
    // From a promise callback so no state is set synchronously in the effect.
    void Promise.resolve().then(load);
  }, []);

  // The published edition with the newest published_at is what staff see.
  const currentId = editions
    .filter((e) => e.is_published)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))[0]?.id;

  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleFiles = async (fileList: FileList | null) => {
    if (!draft || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    try {
      const pdf = files.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      if (pdf) {
        if (draft.pages.length > 0 && !confirm("Replace the current pages with the pages from this PDF?")) return;
        setUploadStatus("Reading PDF...");
        const { pdfToPngBlobs } = await import("@/lib/pdf-to-images");
        const blobs = await pdfToPngBlobs(pdf, (done, total) => setUploadStatus(`Converting page ${done} of ${total}...`));
        if (blobs.length > HANDBOOK_MAX_PAGES) throw new Error(`That PDF has ${blobs.length} pages -- the limit is ${HANDBOOK_MAX_PAGES}.`);
        const pages: DraftPage[] = [];
        for (let i = 0; i < blobs.length; i++) {
          setUploadStatus(`Uploading page ${i + 1} of ${blobs.length}...`);
          pages.push({ path: await uploadFile(blobs[i], "image/png"), preview: URL.createObjectURL(blobs[i]) });
        }
        setUploadStatus("Uploading the PDF for download...");
        const pdfPath = await uploadFile(pdf, "application/pdf");
        patchDraft({ pages, pdfPath });
      } else {
        const images = files.filter((f) => ["image/png", "image/jpeg", "image/webp"].includes(f.type));
        if (images.length === 0) throw new Error("Pick PNG, JPG or WebP images, or a PDF.");
        if (draft.pages.length + images.length > HANDBOOK_MAX_PAGES) throw new Error(`The handbook can have at most ${HANDBOOK_MAX_PAGES} pages.`);
        // Pages go in filename order, so "page-1.png ... page-12.png" picked together land in the right order.
        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const added: DraftPage[] = [];
        for (let i = 0; i < images.length; i++) {
          setUploadStatus(`Uploading image ${i + 1} of ${images.length}...`);
          added.push({ path: await uploadFile(images[i], images[i].type), preview: URL.createObjectURL(images[i]) });
        }
        patchDraft({ pages: [...draft.pages, ...added] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadStatus(null);
    }
  };

  const movePage = (index: number, delta: -1 | 1) => {
    if (!draft) return;
    const pages = [...draft.pages];
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    patchDraft({ pages });
  };

  const updateEntry = (i: number, patch: Partial<{ title: string; page: string }>) => {
    if (!draft) return;
    patchDraft({ contents: draft.contents.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };

  const addEntry = (page?: number) => {
    if (!draft) return;
    patchDraft({ contents: [...draft.contents, { title: "", page: page ? String(page) : "" }] });
  };

  const save = async (publish: boolean) => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    const contents: HandbookContentsEntry[] = draft.contents
      .filter((c) => c.title.trim())
      .map((c) => ({ title: c.title, page: Number(c.page) }));
    const body = {
      title: draft.title,
      versionLabel: draft.versionLabel,
      notes: draft.notes,
      visibility: draft.visibility,
      pagePaths: draft.pages.map((p) => p.path),
      pdfPath: draft.pdfPath,
      contents,
      isPublished: publish,
    };
    const res = await fetch(draft.id ? `/api/admin/handbook/${draft.id}` : "/api/admin/handbook", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(publish ? "Saved. Published editions show at /staff-handbook (the newest published one is the current handbook)." : "Saved as a draft.");
      setDraft(null);
      await load();
    } else {
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const patchEdition = async (edition: Edition, body: Record<string, unknown>) => {
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/admin/handbook/${edition.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Failed to update.");
    await load();
  };

  const remove = async (edition: Edition) => {
    if (!confirm(`Delete "${editionLabel(edition)}" and its uploaded pages? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/handbook/${edition.id}`, { method: "DELETE" });
    if (!res.ok) setError("Failed to delete.");
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="font-display text-3xl text-gnome-green">Staff Handbook</h1>
        {!draft && <Button size="sm" onClick={() => { setDraft(emptyDraft()); setError(null); setStatus(null); }}>+ Upload New Edition</Button>}
      </div>
      <p className="text-bark-brown-light mb-6">
        Upload the finished handbook as page images or a PDF. The newest published edition is what staff read at{" "}
        <Link href="/staff-handbook" className="text-gnome-green hover:underline">/staff-handbook</Link>; earlier ones stay
        readable from there. Pages are stored privately -- only people allowed to read the handbook can load them.
      </p>

      {error && <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

      {draft && (
        <Card hover={false} className="mb-8">
          <h2 className="font-display text-xl text-bark-brown mb-4">{draft.id ? "Edit Edition" : "New Edition"}</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-bark-brown mb-1">Title</label>
                <input type="text" value={draft.title} maxLength={100} onChange={(e) => patchDraft({ title: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-bark-brown mb-1">Version (optional)</label>
                <input type="text" value={draft.versionLabel} maxLength={60} onChange={(e) => patchDraft({ versionLabel: e.target.value })} placeholder="e.g. v2.1 or October 2026" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-bark-brown mb-1">Who can read it</label>
                <select value={draft.visibility} onChange={(e) => patchDraft({ visibility: e.target.value as AccessLevel })} className={`${inputClass} cursor-pointer`}>
                  {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">What changed (optional)</label>
              <textarea value={draft.notes} maxLength={1000} rows={2} onChange={(e) => patchDraft({ notes: e.target.value })} placeholder="e.g. New section on running bingo events; updated promotion requirements." className={inputClass} />
              <p className="text-xs text-iron-grey mt-1">Shown under the title so staff know what&apos;s new.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Pages</label>
              <label className="flex flex-col items-center justify-center gap-1 px-4 py-6 rounded-md border-2 border-dashed border-bark-brown-light bg-parchment-dark/30 text-center cursor-pointer hover:bg-parchment-dark/50">
                <span className="text-sm font-semibold text-bark-brown">{uploadStatus ?? "Choose page images or a PDF"}</span>
                <span className="text-xs text-iron-grey">
                  PNG, JPG or WebP (pick several at once -- they&apos;re ordered by filename), or one PDF (each page becomes an image, and the PDF is offered as a download). Up to {HANDBOOK_MAX_PAGES} pages.
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  multiple
                  disabled={!!uploadStatus}
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>

              {draft.pages.length > 0 && (
                <ol className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {draft.pages.map((p, i) => (
                    <li key={p.path} className="rounded-md border border-bark-brown-light/50 bg-parchment p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt={`Page ${i + 1}`} className="w-full h-32 object-cover object-top rounded bg-white" />
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="font-semibold text-bark-brown">Page {i + 1}</span>
                        <span className="flex gap-2">
                          <button type="button" onClick={() => movePage(i, -1)} disabled={i === 0} aria-label="Move earlier" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">←</button>
                          <button type="button" onClick={() => movePage(i, 1)} disabled={i === draft.pages.length - 1} aria-label="Move later" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">→</button>
                          <button type="button" onClick={() => patchDraft({ pages: draft.pages.filter((_, j) => j !== i) })} aria-label="Remove page" className="text-red-accent cursor-pointer">✕</button>
                        </span>
                      </div>
                      <button type="button" onClick={() => addEntry(i + 1)} className="mt-1 text-[11px] text-gnome-green hover:underline cursor-pointer">
                        + Contents entry here
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {draft.pdfPath && (
                <p className="mt-3 text-xs text-bark-brown">
                  📄 PDF attached for download ·{" "}
                  <button type="button" onClick={() => patchDraft({ pdfPath: null })} className="text-red-accent hover:underline cursor-pointer">remove</button>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Contents (optional)</label>
              <p className="text-xs text-iron-grey mb-2">
                Chapters and the page each starts on. Readers get these as a clickable contents list, and the page toolbar shows which chapter they&apos;re in.
              </p>
              {draft.contents.length > 0 && (
                <ol className="space-y-2 mb-2">
                  {draft.contents.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={c.title}
                        maxLength={120}
                        onChange={(e) => updateEntry(i, { title: e.target.value })}
                        placeholder="Chapter title, e.g. Discipline"
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="number"
                        min={1}
                        max={draft.pages.length || undefined}
                        value={c.page}
                        onChange={(e) => updateEntry(i, { page: e.target.value })}
                        placeholder="Page"
                        aria-label="Starts on page"
                        className={`${inputClass} w-24 shrink-0`}
                      />
                      <button type="button" onClick={() => patchDraft({ contents: draft.contents.filter((_, j) => j !== i) })} aria-label="Remove entry" className="text-red-accent text-xs cursor-pointer px-2">✕</button>
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" onClick={() => addEntry()} className="text-xs text-gnome-green hover:underline cursor-pointer">+ Add contents entry</button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" disabled={saving || !!uploadStatus || draft.pages.length === 0} onClick={() => save(true)}>
                {saving ? "Saving..." : draft.isPublished ? "Save" : "Publish"}
              </Button>
              {!draft.isPublished && (
                <Button size="sm" variant="secondary" disabled={saving || !!uploadStatus} onClick={() => save(false)}>
                  Save Draft
                </Button>
              )}
              <button type="button" onClick={() => setDraft(null)} disabled={saving} className="text-sm text-iron-grey hover:underline cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      <h2 className="font-display text-xl text-bark-brown mb-3">Editions</h2>
      {editions.length === 0 ? (
        <Card hover={false}>
          <p className="text-sm text-iron-grey">
            No uploaded handbook yet -- until one is published, /staff-handbook keeps showing the old text sections.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {editions.map((edition) => {
            const isCurrent = edition.id === currentId;
            return (
              <Card key={edition.id} hover={false} className="flex flex-col sm:flex-row sm:items-center gap-3">
                {edition.page_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={edition.page_urls[0]} alt="" className="w-16 h-20 object-cover object-top rounded border border-bark-brown-light/40 shrink-0 bg-white" />
                ) : (
                  <div className="w-16 h-20 rounded bg-parchment-dark/50 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-bark-brown">
                    {editionLabel(edition)}
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        isCurrent ? "bg-gnome-green/15 text-gnome-green" : edition.is_published ? "bg-gold/20 text-bark-brown" : "bg-iron-grey/15 text-iron-grey"
                      }`}
                    >
                      {isCurrent ? "Current" : edition.is_published ? "Older edition" : "Draft"}
                    </span>
                  </p>
                  <p className="text-xs text-iron-grey">
                    {edition.page_urls.length} page{edition.page_urls.length === 1 ? "" : "s"}
                    {edition.pdf_url ? " · PDF" : ""}
                    {edition.contents.length > 0 ? ` · ${edition.contents.length} contents entries` : ""}
                    {edition.published_at ? ` · published ${formatEditionDate(edition.published_at)}` : ""}
                    {edition.created_by ? ` · by ${edition.created_by}` : ""}
                  </p>
                  {edition.notes && <p className="text-sm text-bark-brown-light truncate">{edition.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-3 text-sm shrink-0">
                  {edition.is_published && (
                    <Link href={isCurrent ? "/staff-handbook" : `/staff-handbook?edition=${edition.id}`} className="text-gnome-green hover:underline">View</Link>
                  )}
                  <button type="button" onClick={() => { setDraft(draftFrom(edition)); setError(null); setStatus(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-gnome-green hover:underline cursor-pointer">Edit</button>
                  {edition.is_published && !isCurrent && (
                    <button type="button" onClick={() => patchEdition(edition, { makeCurrent: true })} className="text-gnome-green hover:underline cursor-pointer">Make current</button>
                  )}
                  <button type="button" onClick={() => patchEdition(edition, { isPublished: !edition.is_published })} className="text-gnome-green hover:underline cursor-pointer">
                    {edition.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button type="button" onClick={() => remove(edition)} className="text-red-accent hover:underline cursor-pointer">Delete</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
