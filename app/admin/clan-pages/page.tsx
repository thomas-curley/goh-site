"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { CLAN_PAGE_MAX_PAGES, CLAN_PAGE_SLUGS, CLAN_PAGE_TITLES, type ClanPage, type ClanPageSlug } from "@/lib/clan-pages-format";

const STORAGE_BUCKET = "banners";

const FALLBACK_NOTE: Record<ClanPageSlug, string> = {
  "rank-structure": "Until something is uploaded, the page shows the rank list from the About page.",
  "clan-rules": "Until something is uploaded, the page shows the rules from the old text handbook.",
};

interface Draft {
  pageUrls: string[];
  pdfUrl: string | null;
}

async function uploadFile(file: Blob, name: string, contentType: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const path = `clan-pages/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export default function AdminClanPagesPage() {
  const [saved, setSaved] = useState<Partial<Record<ClanPageSlug, ClanPage>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/clan-pages");
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const bySlug: Partial<Record<ClanPageSlug, ClanPage>> = {};
      for (const page of (data.pages ?? []) as ClanPage[]) bySlug[page.slug] = page;
      setSaved(bySlug);
    } else {
      setError(data.error ?? "Failed to load the pages.");
    }
    setLoading(false);
  };

  useEffect(() => {
    // From a promise callback so no state is set synchronously in the effect.
    void Promise.resolve().then(load);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-gnome-green mb-1">Rank Structure &amp; Rules</h1>
      <p className="text-bark-brown-light mb-6">
        Upload the finished Rank Structure and Clan Rules as page images or a PDF. They appear under the Clan menu at{" "}
        <Link href="/rank-structure" className="text-gnome-green hover:underline">/rank-structure</Link> and{" "}
        <Link href="/clan-rules" className="text-gnome-green hover:underline">/clan-rules</Link>, and anyone can view them.
      </p>
      {error && <div className="mb-4 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      <div className="space-y-6">
        {CLAN_PAGE_SLUGS.map((slug) => (
          <PageEditor key={`${slug}-${saved[slug]?.updated_at ?? "new"}`} slug={slug} saved={saved[slug] ?? null} onSaved={load} />
        ))}
      </div>
    </div>
  );
}

function PageEditor({ slug, saved, onSaved }: { slug: ClanPageSlug; saved: ClanPage | null; onSaved: () => Promise<void> }) {
  const title = CLAN_PAGE_TITLES[slug];
  const [draft, setDraft] = useState<Draft>({ pageUrls: saved?.page_urls ?? [], pdfUrl: saved?.pdf_url ?? null });
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify({ pageUrls: saved?.page_urls ?? [], pdfUrl: saved?.pdf_url ?? null });

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setError(null);
    setStatus(null);
    try {
      const pdf = files.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
      if (pdf) {
        if (draft.pageUrls.length > 0 && !confirm("Replace the current images with the pages from this PDF?")) return;
        setUploadStatus("Reading PDF...");
        const { pdfToPngBlobs } = await import("@/lib/pdf-to-images");
        const blobs = await pdfToPngBlobs(pdf, (done, total) => setUploadStatus(`Converting page ${done} of ${total}...`));
        if (blobs.length > CLAN_PAGE_MAX_PAGES) throw new Error(`That PDF has ${blobs.length} pages -- the limit is ${CLAN_PAGE_MAX_PAGES}.`);
        const pageUrls: string[] = [];
        for (let i = 0; i < blobs.length; i++) {
          setUploadStatus(`Uploading page ${i + 1} of ${blobs.length}...`);
          pageUrls.push(await uploadFile(blobs[i], `${slug}-page-${i + 1}.png`, "image/png"));
        }
        setUploadStatus("Uploading the PDF for download...");
        const pdfUrl = await uploadFile(pdf, safeName(pdf.name), "application/pdf");
        setDraft({ pageUrls, pdfUrl });
      } else {
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) throw new Error("Pick PNG/JPG/WebP images or a PDF.");
        if (draft.pageUrls.length + images.length > CLAN_PAGE_MAX_PAGES) throw new Error(`A page can have at most ${CLAN_PAGE_MAX_PAGES} images.`);
        // Images go in filename order, so "rules-1.png, rules-2.png" picked together land in the right order.
        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const added: string[] = [];
        for (let i = 0; i < images.length; i++) {
          setUploadStatus(`Uploading image ${i + 1} of ${images.length}...`);
          added.push(await uploadFile(images[i], safeName(images[i].name), images[i].type));
        }
        setDraft((d) => ({ ...d, pageUrls: [...d.pageUrls, ...added] }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadStatus(null);
    }
  };

  const movePage = (index: number, delta: -1 | 1) => {
    const pages = [...draft.pageUrls];
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target], pages[index]];
    setDraft({ ...draft, pageUrls: pages });
  };

  const save = async (next: Draft) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await fetch(`/api/admin/clan-pages/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }
    await onSaved();
  };

  const clear = () => {
    if (!confirm(`Remove the uploaded ${title}? The page goes back to its built-in version.`)) return;
    void save({ pageUrls: [], pdfUrl: null });
  };

  return (
    <Card hover={false}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-xl text-bark-brown">{title}</h2>
        <Link href={`/${slug}`} className="text-sm text-gnome-green hover:underline">View page →</Link>
      </div>
      <p className="text-xs text-iron-grey mb-3">
        {saved && saved.page_urls.length > 0
          ? `Live: ${saved.page_urls.length} image${saved.page_urls.length === 1 ? "" : "s"}${saved.updated_by ? `, updated by ${saved.updated_by}` : ""} on ${new Date(saved.updated_at).toLocaleDateString()}.`
          : FALLBACK_NOTE[slug]}
      </p>

      {error && <div className="mb-3 p-3 rounded-md bg-red-accent/10 border border-red-accent/30 text-sm text-red-accent">{error}</div>}
      {status && <div className="mb-3 p-3 rounded-md bg-gnome-green/10 border border-gnome-green/30 text-sm text-gnome-green">{status}</div>}

      <label className="flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-md border-2 border-dashed border-bark-brown-light bg-parchment-dark/30 text-center cursor-pointer hover:bg-parchment-dark/50">
        <span className="text-sm font-semibold text-bark-brown">{uploadStatus ?? "Choose images or a PDF"}</span>
        <span className="text-xs text-iron-grey">
          PNG, JPG or WebP (pick several at once -- they&apos;re ordered by filename), or one PDF (each page becomes an image, and the PDF is offered as a download).
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          multiple
          disabled={!!uploadStatus || saving}
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
              <img src={url} alt={`Image ${i + 1}`} className="w-full h-32 object-cover object-top rounded bg-white" />
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="font-semibold text-bark-brown">{i + 1}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => movePage(i, -1)} disabled={i === 0} aria-label="Move earlier" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">←</button>
                  <button type="button" onClick={() => movePage(i, 1)} disabled={i === draft.pageUrls.length - 1} aria-label="Move later" className="text-gnome-green disabled:text-iron-grey/40 cursor-pointer">→</button>
                  <button type="button" onClick={() => setDraft({ ...draft, pageUrls: draft.pageUrls.filter((_, j) => j !== i) })} aria-label="Remove image" className="text-red-accent cursor-pointer">✕</button>
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
          <button type="button" onClick={() => setDraft({ ...draft, pdfUrl: null })} className="text-red-accent hover:underline cursor-pointer">remove</button>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Button size="sm" disabled={saving || !!uploadStatus || !dirty || draft.pageUrls.length === 0} onClick={() => save(draft)}>
          {saving ? "Saving..." : "Publish"}
        </Button>
        {dirty && (
          <button type="button" onClick={() => setDraft({ pageUrls: saved?.page_urls ?? [], pdfUrl: saved?.pdf_url ?? null })} disabled={saving} className="text-sm text-iron-grey hover:underline cursor-pointer">
            Discard changes
          </button>
        )}
        {saved && saved.page_urls.length > 0 && (
          <button type="button" onClick={clear} disabled={saving} className="text-sm text-red-accent hover:underline cursor-pointer">
            Remove upload
          </button>
        )}
      </div>
    </Card>
  );
}
