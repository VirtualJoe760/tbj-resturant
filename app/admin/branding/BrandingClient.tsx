"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/Toast";
import { diffBranding, FONTS, fontById, HERO_PAGES, heroFor, inkFor, MAX_HERO_PHOTOS, STYLES, type Branding } from "@/domain/branding";
import type { HeroPage } from "@/config/types";
import { saveBranding } from "@/server/actions/branding";
import { uploadImage as upload, type ImageKind } from "@/components/upload-image";

type Kind = ImageKind;

const COLORS: [keyof Branding["theme"], string, string][] = [
  ["primary", "Accent", "Buttons, prices, highlights"],
  ["header", "Header", "Top of the screen, home header, app background"],
  ["bg", "Page", "Behind the menu and cards"],
];

export function BrandingClient({ initial, base, name, shortName, tagline }: { initial: Branding; base: Branding; name: string; shortName: string; tagline: string }) {
  const [b, setB] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null); // "logo", "icon", "item" or "hero:<page>"
  const [saving, start] = useTransition();
  const router = useRouter();
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const set = (patch: Partial<Branding>) => setB((x) => ({ ...x, ...patch }));

  const pick = (kind: Kind, multiple = false, page?: HeroPage) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.multiple = multiple;
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      if (!files.length) return;
      setBusy(page ? `hero:${page}` : kind);
      try {
        for (const f of files) {
          const m = await upload(f, kind);
          if (kind === "logo") set({ logoUrl: m.url });
          if (kind === "icon") set({ iconUrl: m.url });
          if (kind === "banner" && page) setB((x) => ({ ...x, heroes: { ...x.heroes, [page]: [...x.heroes[page], m.url].slice(0, MAX_HERO_PHOTOS) } }));
          if (kind === "item") setB((x) => ({ ...x, gallery: [...x.gallery, { src: m.url }].slice(0, 24) }));
        }
      } catch (e) { toast((e as Error).message); }
      setBusy(null);
    };
    input.click();
  };

  const save = () => start(async () => {
    const r = await saveBranding({ ...b, theme: { primary: b.theme.primary, header: b.theme.header, bg: b.theme.bg } });
    toast(r.message);
    if (r.ok) { setSaved(b); router.refresh(); }
  });

  const setHero = (page: HeroPage, urls: string[]) => set({ heroes: { ...b.heroes, [page]: urls } });
  const move = (page: HeroPage, i: number, d: number) => {
    const next = [...b.heroes[page]]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); setHero(page, next);
  };
  const moveG = (i: number, d: number) => {
    const next = [...b.gallery]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); set({ gallery: next });
  };
  const ink = inkFor(b.theme.primary);
  const iconSrc = b.iconUrl;
  const LABEL: Record<string, string> = { style: "style", gallery: "gallery", theme: "colors", headingFont: "heading font", bodyFont: "body font", logoUrl: "logo", iconUrl: "app icon", heroes: "hero carousels" };
  const changed = Object.keys(diffBranding({ ...b, theme: { ...b.theme, primaryInk: ink } }, base)).map((k) => LABEL[k] ?? k);

  return (
    <div className="has-bar">
      <div className="note panel pad" style={{ padding: "10px 12px" }}>
        These start from <code>src/config/business-theme.ts</code> (images in <code>public/brand/</code>).
        {changed.length ? <> Changed here: <b>{changed.join(", ")}</b>. <button type="button" className="linkbtn" onClick={() => setB(base)}>Reset to the theme file</button></> : " Nothing is changed here."}
      </div>
      <div className="brand-grid">
        <div>
          <div className="sec">Style</div>
          <div className="style-picks">
            {STYLES.map((st) => (
              <button type="button" key={st.id} className={`style-pick sp-${st.id} ${b.style === st.id ? "on" : ""}`} onClick={() => set({ style: st.id })} style={{ ["--p" as string]: b.theme.primary, ["--h" as string]: b.theme.header }}>
                <span className="sp-demo"><i /><b /><b /></span>
                <strong>{st.label}</strong>
                <small>{st.hint}</small>
              </button>
            ))}
          </div>

          <div className="sec">Logo</div>
          <div className="panel pad">
            <div className="logo-well" style={{ background: b.theme.header }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.logoUrl ? <img src={b.logoUrl} alt="Logo" /> : <span style={{ color: "#fff", fontFamily: fontById(b.headingFont).stack, fontWeight: 800 }}>{shortName.toUpperCase()}</span>}
            </div>
            <div className="chips">
              <button type="button" className="on" onClick={() => pick("logo")} disabled={!!busy}>{busy === "logo" ? "Uploading…" : b.logoUrl ? "Replace logo" : "Upload logo"}</button>
              {b.logoUrl && <button type="button" onClick={() => set({ logoUrl: null })}>Remove</button>}
            </div>
            <p className="note">A PNG with a see-through background looks best. It shows on the home page and in the top bar on computers.</p>
          </div>

          {HERO_PAGES.map(({ id, label, hint }) => {
            const urls = b.heroes[id];
            return (
              <div key={id}>
                <div className="sec">{label} <span className="muted small">{urls.length}/{MAX_HERO_PHOTOS}</span></div>
                <div className="panel pad">
                  <p className="note">
                    {hint}{" "}
                    {urls.length ? "Photos crossfade in this order." : id === "home" ? "No photos yet, so it uses the header color." : b.heroes.home.length ? "No photos yet, so it uses the home carousel." : "No photos yet, so it uses the header color."}
                    {id === "home" && " Wide photos of food or the room work best."}
                  </p>
                  <div className="item-photos hero-photos">
                    {urls.map((u, i) => (
                      <div className="ph" key={u}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`${label} photo ${i + 1}`} />
                        {i === 0 && <span className="ph-first">First</span>}
                        <div className="ph-tools">
                          <button type="button" disabled={i === 0} onClick={() => move(id, i, -1)} aria-label="Move left">‹</button>
                          <button type="button" onClick={() => setHero(id, urls.filter((_, k) => k !== i))} aria-label="Remove photo">✕</button>
                          <button type="button" disabled={i === urls.length - 1} onClick={() => move(id, i, 1)} aria-label="Move right">›</button>
                        </div>
                      </div>
                    ))}
                    {urls.length < MAX_HERO_PHOTOS && <button type="button" className="ph add" onClick={() => pick("banner", true, id)} disabled={!!busy}>{busy === `hero:${id}` ? "Uploading…" : "+ Photos"}</button>}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="sec">Photo gallery <span className="muted small">{b.gallery.length}/24</span></div>
          <div className="panel pad">
            <p className="note">Shown in a &quot;Photos&quot; strip on the home page: food, the room, the crew. For dish photos on the menu, use Admin → Menu.</p>
            <div className="item-photos" style={{ flexWrap: "wrap" }}>
              {b.gallery.map((g, i) => (
                <div className="ph" key={g.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.src} alt={g.alt ?? `Photo ${i + 1}`} />
                  <div className="ph-tools">
                    <button type="button" disabled={i === 0} onClick={() => moveG(i, -1)} aria-label="Move left">‹</button>
                    <button type="button" onClick={() => set({ gallery: b.gallery.filter((_, k) => k !== i) })} aria-label="Remove photo">✕</button>
                    <button type="button" disabled={i === b.gallery.length - 1} onClick={() => moveG(i, 1)} aria-label="Move right">›</button>
                  </div>
                </div>
              ))}
              {b.gallery.length < 24 && <button type="button" className="ph add" onClick={() => pick("item", true)} disabled={!!busy}>{busy === "item" ? "Uploading…" : "+ Photos"}</button>}
            </div>
          </div>

          <div className="sec">Fonts</div>
          <div className="panel pad">
            {(["headingFont", "bodyFont"] as const).map((k) => (
              <label className="field" key={k}>
                <span>{k === "headingFont" ? "Headings (name, page titles)" : "Everything else"}</span>
                <select value={b[k]} onChange={(e) => set({ [k]: e.target.value })} style={{ fontFamily: fontById(b[k]).stack }}>
                  {FONTS.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>{f.label}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="sec">Colors</div>
          <div className="panel pad">
            {COLORS.map(([k, label, hint]) => (
              <label className="color-row" key={k}>
                <input type="color" value={b.theme[k]} onChange={(e) => set({ theme: { ...b.theme, [k]: e.target.value } })} />
                <div className="grow"><b>{label}</b><small>{hint}</small></div>
                <code>{b.theme[k]}</code>
              </label>
            ))}
            <p className="note">Button text switches between black and white by itself so it stays readable.</p>
          </div>

          <div className="sec">App icon</div>
          <div className="panel pad">
            <div className="icon-row">
              <div className="home-icon" style={{ background: b.theme.header }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {iconSrc ? <img src={iconSrc} alt="App icon" /> : <span style={{ color: b.theme.primary }}>{shortName.replace(/^The\s+/i, "").slice(0, 1)}</span>}
              </div>
              <div className="grow">
                <b>{shortName}</b>
                <small className="muted" style={{ display: "block" }}>How it looks on a phone&apos;s home screen and in the app stores. Use a square image at least 512 × 512 and keep the important part in the middle.</small>
              </div>
            </div>
            <div className="chips">
              <button type="button" className="on" onClick={() => pick("icon")} disabled={!!busy}>{busy === "icon" ? "Uploading…" : iconSrc ? "Replace icon" : "Upload icon"}</button>
              {iconSrc && <button type="button" onClick={() => set({ iconUrl: null })}>Use the letter instead</button>}
            </div>
          </div>
        </div>

        <div className="preview-col">
          <div className="sec">Preview</div>
          <div className={`phone pv-${b.style}`} style={{ background: b.style === "midnight" ? "#09090b" : b.style === "diner" ? "#fbf5e9" : b.style === "minimal" ? "#fff" : b.theme.bg, fontFamily: fontById(b.bodyFont).stack }}>
            <div className="p-hero" style={{ background: heroFor(b, "home")[0] ? `linear-gradient(rgb(0 0 0 / .35), rgb(0 0 0 / .72)), url(${heroFor(b, "home")[0]}) center/cover` : b.theme.header }}>
              <small style={{ color: "#86efac" }}>● Open now</small>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.logoUrl && <img src={b.logoUrl} alt="" />}
              <b style={{ fontFamily: fontById(b.headingFont).stack }}>{name}</b>
              <span>{tagline}</span>
              <i style={{ background: b.theme.primary, color: ink }}>Order now →</i>
            </div>
            <div className="p-card"><b>Menu item</b><span style={{ color: "#78716c" }}>A short description</span><em>$12.99</em></div>
            <div className="p-card"><b>Another item</b><span style={{ color: "#78716c" }}>Fresh and made to order</span><em>$9.50</em></div>
          </div>
        </div>
      </div>
      <div className="bar">
        <button className="btn center" disabled={!dirty || saving || !!busy} onClick={save}>{saving ? "Saving…" : dirty ? "Save branding" : "All changes saved"}</button>
      </div>
    </div>
  );
}
