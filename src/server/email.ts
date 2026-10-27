import "server-only";
import type { Db } from "@/db/client";
import { schema as s } from "@/db/client";
import { isDemo, restaurant } from "@/config/restaurant";
import { businessTheme } from "@/config/business-theme";
import { money } from "@/domain/pricing";

// Every email goes through here. Demo: captured in the Demo inbox (/demo/inbox).
// Live: stored as "queued" for the outbox worker to send through Resend (docs/06).
export async function sendEmail(db: Db, mail: { to: string; subject: string; html: string; kind: string }) {
  await db.insert(s.emails).values({ ...mail, status: isDemo || !process.env.RESEND_API_KEY ? "captured" : "queued" });
}

const wrap = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;border:1px solid #e7e5e4;border-radius:14px;overflow:hidden">
  <div style="background:${businessTheme.colors.header};color:#fff;padding:16px 18px;font-weight:800">${restaurant.name}</div>
  <div style="padding:16px 18px;font-size:14px;line-height:1.5">${body}</div>
  <div style="padding:12px 18px;font-size:11px;color:#78716c;border-top:1px solid #e7e5e4">${restaurant.address}</div></div>`;

export function receiptEmail(o: { number: string; customerName: string; subtotalCents: number; taxCents: number; tipCents: number; totalCents: number; id: string },
  lines: { nameSnapshot: string; quantity: number; lineTotalCents: number; modifiersText: string[] }[]) {
  const rows = lines.map((l) => `<tr><td style="padding:6px 0"><b>${l.quantity}× ${l.nameSnapshot}</b><br><span style="color:#78716c;font-size:12px">${l.modifiersText.join(" · ")}</span></td><td style="text-align:right;vertical-align:top">${money(l.lineTotalCents)}</td></tr>`).join("");
  return wrap(`<p>Thanks, ${o.customerName}! Order <b>#${o.number}</b> is in. We'll text you when it's ready.</p>
<table style="width:100%;border-collapse:collapse">${rows}</table><hr style="border:0;border-top:1px solid #e7e5e4">
<table style="width:100%">${[["Subtotal", o.subtotalCents], ["Tax", o.taxCents], ["Tip", o.tipCents]].map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${money(v as number)}</td></tr>`).join("")}
<tr><td><b>Total</b></td><td style="text-align:right"><b>${money(o.totalCents)}</b></td></tr></table>`);
}

export const simpleEmail = (html: string) => wrap(html);
