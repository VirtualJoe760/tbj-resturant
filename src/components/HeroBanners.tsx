"use client";
import { useEffect, useState } from "react";

/** Crossfading banner photos behind the home page header. */
export function HeroBanners({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % urls.length), 6000);
    return () => clearInterval(t);
  }, [urls.length]);
  return (
    <div className="banners" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {urls.map((u, k) => <img key={u} src={u} alt="" className={k === i ? "on" : ""} loading={k ? "lazy" : "eager"} />)}
    </div>
  );
}
