"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cart, useCart } from "@/components/cart-store";
import { money, priceCart } from "@/domain/pricing";
import { placeOrder } from "@/server/actions/public";

const TIPS = [0, 0.15, 0.18, 0.2];

export function CheckoutClient({ taxRate, demoPayments, defaults }: { taxRate: number; demoPayments: boolean; defaults: { name: string; email: string } }) {
  const lines = useCart();
  const router = useRouter();
  const [tipPct, setTip] = useState(0.15);
  const [form, setForm] = useState({ name: defaults.name, phone: "", email: defaults.email, notes: "" });
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", zip: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = priceCart(lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity })), { taxRate, tipPct });

  if (!lines.length) return <div className="card">Your order is empty. <Link href="/menu">Browse the menu</Link></div>;

  const submit = async () => {
    setErr("");
    if (demoPayments && card.number.replace(/\s/g, "") !== "4242424242424242") return setErr("Demo site: use the test card (tap “Fill test card”).");
    setBusy(true);
    const r = await placeOrder({ lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections, instructions: l.instructions })), ...form, tipPct });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    cart.clear();
    if (r.redirectUrl) window.location.href = r.redirectUrl;
    else router.push(`/order/${r.orderId}`);
  };
  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });
  const c = (k: keyof typeof card) => ({ value: card[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCard({ ...card, [k]: e.target.value }) });

  return (
    <div className="has-bar">
      <div className="sec">Your details</div>
      <label className="field"><span>Name for the order *</span><input {...f("name")} autoComplete="name" /></label>
      <div className="two">
        <label className="field"><span>Mobile (we text when ready) *</span><input {...f("phone")} type="tel" autoComplete="tel" /></label>
        <label className="field"><span>Email for receipt</span><input {...f("email")} type="email" autoComplete="email" /></label>
      </div>
      <label className="field"><span>Notes for the kitchen</span><input {...f("notes")} placeholder="Allergies, extra napkins…" /></label>

      <div className="sec">Tip the crew</div>
      <div className="chips">
        {TIPS.map((p) => <button key={p} className={tipPct === p ? "on" : ""} onClick={() => setTip(p)}>{p ? `${p * 100}%` : "No tip"}</button>)}
      </div>

      <div className="sec">Payment {demoPayments && <button className="ibtn" onClick={() => setCard({ number: "4242 4242 4242 4242", exp: "12/30", cvc: "123", zip: "92260" })}>Fill test card</button>}</div>
      {demoPayments ? (
        <div className="panel">
          <div className="note" style={{ margin: "10px 12px 0" }}>Demo checkout — no real charge. On the live site this is Stripe (Apple Pay, Google Pay, cards).</div>
          <label className="field"><span>Card number</span><input {...c("number")} inputMode="numeric" placeholder="4242 4242 4242 4242" /></label>
          <div className="two">
            <label className="field"><span>Expiry</span><input {...c("exp")} placeholder="MM/YY" /></label>
            <label className="field"><span>CVC</span><input {...c("cvc")} placeholder="123" /></label>
          </div>
        </div>
      ) : (
        <div className="note">You&apos;ll pay on Stripe&apos;s secure page (Apple Pay, Google Pay, cards).</div>
      )}

      <div className="totals">
        <div><span>Subtotal</span><span>{money(t.subtotal)}</span></div>
        <div><span>Tax</span><span>{money(t.tax)}</span></div>
        <div><span>Tip</span><span>{money(t.tip)}</span></div>
        <div className="grand"><span>Total</span><span>{money(t.total)}</span></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="bar">
        <button className="btn" disabled={busy || !form.name || form.phone.length < 7} onClick={submit}>
          <span>{busy ? "Placing order…" : "Place order"}</span><span>{money(t.total)}</span>
        </button>
      </div>
    </div>
  );
}
