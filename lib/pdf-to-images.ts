// Browser-only: renders each page of a PDF to a PNG, so a newsletter made
// as a PDF can be shown as images (which read far better on phones than an
// embedded PDF viewer). pdfjs-dist is loaded on demand, only when an admin
// actually picks a PDF. (Pinned to v4: v5+ relies on very new JS built-ins
// that many current browsers don't have yet.)

/** Target width of a rendered page in pixels -- sharp on retina phones, still a sensible file size. */
const TARGET_WIDTH = 1600;

export async function pdfToPngBlobs(file: File, onProgress?: (done: number, total: number) => void): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const blobs: Blob[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser can't render PDFs.");
      await page.render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error(`Couldn't render page ${n}.`);
      blobs.push(blob);
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }
  return blobs;
}
