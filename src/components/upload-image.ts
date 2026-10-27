"use client";
export type ImageKind = "logo" | "icon" | "banner" | "item";
// Resize in the browser before uploading: small files load fast on phones and fit in the database.
const SHAPE: Record<ImageKind, { max: number; square?: boolean; type: string }> = {
  logo: { max: 800, type: "image/png" }, // PNG keeps a transparent background
  icon: { max: 1024, square: true, type: "image/png" },
  banner: { max: 2000, type: "image/jpeg" },
  item: { max: 1600, type: "image/jpeg" },
};

/** Resizes in the browser, uploads to /api/admin/media, returns the new image's URL. */
export async function uploadImage(file: File, kind: ImageKind): Promise<{ id: string; url: string }> {
  const shape = SHAPE[kind];
  const img = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (shape.square) { const side = Math.min(sw, sh); sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side; }
  const scale = Math.min(1, shape.max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't read that image."))), shape.type, 0.85));
  const form = new FormData();
  form.append("file", new File([blob], `${kind}.${shape.type === "image/png" ? "png" : "jpg"}`, { type: shape.type }));
  form.append("width", String(canvas.width)); form.append("height", String(canvas.height));
  const res = await fetch("/api/admin/media", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Upload failed.");
  return json;
}

/** Opens the file picker; resolves with the chosen files (empty if cancelled). */
export function pickFiles(multiple = false): Promise<File[]> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.multiple = multiple;
    input.onchange = () => done([...(input.files ?? [])]);
    input.click();
  });
}
