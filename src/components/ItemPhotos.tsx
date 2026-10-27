"use client";
import { useState, useTransition } from "react";
import { toast } from "@/components/Toast";
import { pickFiles, uploadImage } from "@/components/upload-image";
import { setItemImages } from "@/server/actions/admin";

/** Admin → Menu: add, reorder and remove a menu item's photos. Saves on every change. */
export function ItemPhotos({ itemId, initial }: { itemId: string; initial: string[] }) {
  const [images, setImages] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const save = (next: string[]) => { setImages(next); start(() => setItemImages(itemId, next)); };

  const add = async () => {
    const files = await pickFiles(true);
    if (!files.length) return;
    setBusy(true);
    let next = images;
    try {
      for (const f of files.slice(0, 10 - images.length)) next = [...next, (await uploadImage(f, "item")).url];
      save(next);
      toast(`${files.length > 1 ? `${files.length} photos` : "Photo"} added`);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const move = (i: number, d: number) => { const n = [...images]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); save(n); };

  return (
    <div className="item-photos">
      {images.map((u, i) => (
        <div className="ph" key={u}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Photo ${i + 1}`} />
          <div className="ph-tools">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left">‹</button>
            <button type="button" onClick={() => save(images.filter((_, k) => k !== i))} aria-label="Remove photo">✕</button>
            <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move right">›</button>
          </div>
          {i === 0 && <span className="ph-first">Cover</span>}
        </div>
      ))}
      {images.length < 10 && <button type="button" className="ph add" onClick={add} disabled={busy}>{busy ? "Uploading…" : "+ Photos"}</button>}
    </div>
  );
}
