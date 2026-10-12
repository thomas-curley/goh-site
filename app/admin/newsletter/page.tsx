"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatIssueDate, type Newsletter } from "@/lib/newsletter-format";

const inputClass = "w-full px-3 py-2 rounded-md border border-bark-brown-light bg-parchment text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-gnome-green";

const STORAGE_BUCKET = "banners";
const MAX_PAGES = 12;

interface Draft {
  id: string | null;
  issueNumber: string;
  publishedOn: string;
  title: string;
  headline: string;
  pageUrls: string[];
  pdfUrl: string | null;
  isPublished: boolean;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyDraft(issues: Newsletter[]): Draft {
  const next = issues.reduce((max, n) => Math.max(max, n.issue_number), 0) + 1;
  return { id: null, issueNumber: String(next), publishedOn: today(), title: "The Weekly Glider", headline: "", pageUrls: [], pdfUrl: null, isPublished: false };
}

function draftFrom(n: Newsletter): Draft {
  return {
    id: n.id,
    issueNumber: String(n.issue_number),
    publishedOn: n.published_on,
    title: n.title,
    headline: n.headline ?? "",
    pageUrls: n.page_urls,
    pdfUrl: n.pdf_url,
    isPublished: n.is_published,
  };
}

async function uploadFile(file: Blob, name: string, contentType: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const path = `newsletters/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export default function AdminNewsletterPage() {
  const [issues, setIssues] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/newsletters");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setIssues(data.newsletters ?? []);
    else setError(data.error ?? "Failed to load issues.");
    setLoading(false);
  };

  useEffect(() => {
    // From a promise callback so no state is set synchronously in the effect.
    void Promise.resolve().then(load);
  }, []);

  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleFiles = async (fileList: FileList | null) => {
    if (!draft || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    try {
      const pdf = files.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      if (pdf) {
        if (draft.pageUrls.length > 0 && !confirm("Replace the current pages with the pages from this PDF?")) return;
        setUploadStatus("Reading PDF...");
        const { pdfToPngBlobs } = await import("@/lib/pdf-to-images");
        const blobs = await pdfToPngBlobs(pdf, (done, total) => setUploadStatus(`Converting page ${done} of ${total}...`));
        if (blobs.length > MAX_PAGES) throw new Error(`That PDF has ${blobs.length} pages -- the limit is ${MAX_PAGES}.`);
        const pageUrls: string[] = [];
        for (let i = 0; i < blobs.length; i++) {
          setUploadStatus(`Uploading page ${i + 1} of ${blobs.length}...`);
          pageUrls.push(await uploadFile(blobs[i], `issue-${draft.issueNumber}-page-${i + 1}.png`, "image/png"));
        }
        setUploadStatus("Uploading the PDF for download...");
        const pdfUrl = await uploadFile(pdf, safeName(pdf.name), "application/pdf");
        patchDraft({ pageUrls, pdfUrl });
      } else {
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) throw new Error("Pick PNG/JPG/WebP images or a PDF.");
        if (draft.pageUrls.length + images.length > MAX_PAGES) throw new Error(`An issue can have at most ${MAX_PAGES} pages.`);
        // Pages go in filename order, so "page-1.png, page-2.png" picked together land in the right order.
        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const added: string[] = [];
        for (let i = 0; i < images.length; i++) {
          setUploadStatus(`Uploading image ${i + 1} of ${images.length}...`);
          added.push(await uploadFile(images[i], safeName(images[i].name), images[i].type));
        }
        patchDraft({ pageUrls: [...draft.pageUrls, ...added] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadStatus(null);
    }
  };

  const movePage = (index: number, delta: -1 | 1) => {
    if (!draft) return;
    const pages = [...draft.pageUrls];
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    patchDraft({ pageUrls: pages });
  };

  const save = async (publish: boolean) => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    const body = {
      issueNumber: Number(draft.issueNumber),
      publishedOn: draft.publishedOn,
      title: draft.title,
      headline: draft.headline,
      pageUrls: draft.pageUrls,
      pdfUrl: draft.pdfUrl,
      isPublished: publish,
    };
    const res = await fetch(draft.id ? `/api/admin/newsletters/${draft.id}` : "/api/admin/newsletters", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(publish ? `Issue No. ${body.issueNumber} is live at /newsletter/${body.issueNumber}.` : `Issue No. ${body.issueNumber} saved as a draft.`);
      setDraft(null);
      await load();
    } else {
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  const setPublished = async (issue: Newsletter, publish: boolean) => {
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/admin/newsletters/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: publish }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Failed to update.");
    await load();
  };

  const remove = async (issue: Newsletter) => {
    if (!confirm(`Delete Issue No. ${issue.issue_number}? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/newsletters/${issue.id}`, { method: "DELETE" });
    if (!res.ok) setError("Failed to delete.");
    await load();
  };

  const copyLink = async (issue: Newsletter) => {
    const url = `${window.location.origin}/newsletter/${issue.issue_number}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus(`Copied ${url}`);
    } catch {
      setStatus(url);
    }
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
        <h1 className="font-display text-3xl text-gnome-green">Newsletter</h1>
        {!draft && <Button size="sm" onClick={() => setDraft(emptyDraft(issues))}>+ New Issue</Button>}
      </div>
      <p className="text-bark-brown-light mb-6">
        Upload each week&apos;s issue of The Weekly Glider as page images or a PDF. Published issues appear at{" "}
        <Link href="/newsletter" className="text-gnome-green hover:underline">/newsletter</Link> (the latest) with every
        past issue in its archive.
      </p>

      {error && <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="mb-4 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green break-all">{status}</div>}

      {draft && (
        <Card hover={false} className="mb-8">
          <h2 className="font-display text-xl text-bark-brown mb-4">{draft.id ? `Edit Issue No. ${draft.issueNumber}` : "New Issue"}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-bark-brown mb-1">Issue No.</label>
                <input type="number" min={1} value={draft.issueNumber} onChange={(e) => patchDraft({ issueNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-bark-brown mb-1">Date</label>
                <input type="date" value={draft.publishedOn} onChange={(e) => patchDraft({ publishedOn: e.target.value })} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-bark-brown mb-1">Title</label>
                <input type="text" value={draft.title} maxLength={100} onChange={(e) => patchDraft({ title: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Headline (optional)</label>
              <input
                type="text"
                value={draft.headline}
                maxLength={200}
                onChange={(e) => patchDraft({ headline: e.target.value })}
                placeholder="e.g. Gn0me Home is hiring -- and we want you on the team!"
                className={inputClass}
              />
              <p className="text-xs text-iron-grey mt-1">One line shown in the archive and in the link preview when the issue is shared on Discord.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-bark-brown mb-1">Pages</label>
              <label className="flex flex-col items-center justify-center gap-1 px-4 py-6 rounded-md border-2 border-dashed border-bark-brown-light bg-parchment-dark/30 text-center cursor-pointer hover:bg-parchment-dark/50">
                <span className="text-sm font-semibold text-bark-brown">{uploadStatus ?? "Choose page images or a PDF"}</span>
                <span className="text-xs text-iron-grey">
                  PNG, JPG or WebP (pick several at once -- they&apos;re ordered by filename), or one PDF (each page is converted to an image, and the PDF is offered as a download).
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

              {draft.pageUrls.length > 0 && (
                <ol className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {draft.pageUrls.map((url, i) => (
                    <li key={url} className="rounded-md border border-bark-brown-light/50 bg-parchment p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Page ${i + 1}`} className="w-full h-32 object-cover object-top rounded" />
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="font-semibold text-bark-brown">Page {i + 1}</span>
                        <span className="flex gap-2">
                          <button type="button" onClick={() => movePage(i, -1)} disabled={i === 0} aria-label="Move earlier" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">←</button>
                          <button type="button" onClick={() => movePage(i, 1)} disabled={i === draft.pageUrls.length - 1} aria-label="Move later" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">→</button>
                          <button type="button" onClick={() => patchDraft({ pageUrls: draft.pageUrls.filter((_, j) => j !== i) })} aria-label="Remove page" className="text-red-accent cursor-pointer">✕</button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {draft.pdfUrl && (
                <p className="mt-3 text-xs text-bark-brown">
                  📄 PDF attached for download (
                  <a href={draft.pdfUrl} target="_blank" rel="noreferrer" className="text-gnome-green hover:underline">view</a>
                  ) ·{" "}
                  <button type="button" onClick={() => patchDraft({ pdfUrl: null })} className="text-red-accent hover:underline cursor-pointer">remove</button>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" disabled={saving || !!uploadStatus || draft.pageUrls.length === 0} onClick={() => save(true)}>
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

      <h2 className="font-display text-xl text-bark-brown mb-3">Issues</h2>
      {issues.length === 0 ? (
        <Card hover={false}><p className="text-sm text-iron-grey">No issues yet -- add the first one with &quot;+ New Issue&quot;.</p></Card>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <Card key={issue.id} hover={false} className="flex flex-col sm:flex-row sm:items-center gap-3">
              {issue.page_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={issue.page_urls[0]} alt="" className="w-16 h-20 object-cover object-top rounded border border-bark-brown-light/40 shrink-0" />
              ) : (
                <div className="w-16 h-20 rounded bg-parchment-dark/50 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-bark-brown">
                  Issue No. {issue.issue_number}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${issue.is_published ? "bg-gnome-green/15 text-gnome-green" : "bg-iron-grey/15 text-iron-grey"}`}>
                    {issue.is_published ? "Published" : "Draft"}
                  </span>
                </p>
                <p className="text-xs text-iron-grey">
                  {formatIssueDate(issue.published_on)} · {issue.page_urls.length} page{issue.page_urls.length === 1 ? "" : "s"}
                  {issue.pdf_url ? " · PDF" : ""}
                </p>
                {issue.headline && <p className="text-sm text-bark-brown-light truncate">{issue.headline}</p>}
              </div>
              <div className="flex flex-wrap gap-3 text-sm shrink-0">
                {issue.is_published && (
                  <>
                    <Link href={`/newsletter/${issue.issue_number}`} className="text-gnome-green hover:underline">View</Link>
                    <button type="button" onClick={() => copyLink(issue)} className="text-gnome-green hover:underline cursor-pointer">Copy link</button>
                  </>
                )}
                <button type="button" onClick={() => { setDraft(draftFrom(issue)); setError(null); setStatus(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-gnome-green hover:underline cursor-pointer">Edit</button>
                <button type="button" onClick={() => setPublished(issue, !issue.is_published)} className="text-gnome-green hover:underline cursor-pointer">
                  {issue.is_published ? "Unpublish" : "Publish"}
                </button>
                <button type="button" onClick={() => remove(issue)} className="text-red-accent hover:underline cursor-pointer">Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
