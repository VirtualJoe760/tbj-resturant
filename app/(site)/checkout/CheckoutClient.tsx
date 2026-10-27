"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, useCart } from "@/components/cart-store";
import { money, priceCart } from "@/domain/pricing";
import { getDeliveryQuote, placeOrder } from "@/server/actions/public";
import { trackOrder } from "@/components/alerts-store";

interface DeliveryOption { by: string; minOrderCents: number; state: string; city: string }
interface Quote { quoteRef: string; feeCents: number; etaMinutes: number; by: string; key: string }

const TIPS = [0, 0.15, 0.18, 0.2];

export function CheckoutClient({ taxRate, demoPayments, defaults, delivery, pickupAddress }: {
  taxRate: number; demoPayments: boolean; defaults: { name: string; email: string }; delivery: DeliveryOption | null; pickupAddress: string;
}) {
  const lines = useCart();
  const router = useRouter();
  const [tipPct, setTip] = useState(0.15);
  const [form, setForm] = useState({ name: defaults.name, phone: "", email: defaults.email, notes: "" });
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", zip: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [addr, setAddr] = useState({ street: "", unit: "", city: delivery?.city ?? "", state: delivery?.state ?? "CA", zip: "", instructions: "" });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState("");
  const [retry, setRetry] = useState(0);
  const t = priceCart(lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity })), { taxRate, tipPct });
  const isDelivery = mode === "delivery";
  const addrKey = JSON.stringify([addr.street, addr.unit, addr.city, addr.state, addr.zip, t.subtotal]);
  const addrReady = addr.street.length > 3 && addr.city.length > 1 && /^\d{5}$/.test(addr.zip);
  const underMin = !!delivery && t.subtotal < delivery.minOrderCents;
  const quoteCurrent = !!quote && quote.key === addrKey;
  const deliveryFee = isDelivery && quoteCurrent ? quote!.feeCents : 0;
  const total = t.total + deliveryFee;

  // price the delivery once the address looks complete (and again if it or the order changes)
  const last = useRef("");
  useEffect(() => {
    if (!isDelivery || !addrReady || underMin || last.current === `${addrKey}#${retry}`) return;
    const timer = setTimeout(async () => {
      last.current = `${addrKey}#${retry}`;
      setQuoting(true);
      setQuoteErr("");
      const r = await getDeliveryQuote({ address: addr, subtotalCents: t.subtotal, name: form.name, phone: form.phone });
      setQuoting(false);
      if (r.ok) setQuote({ ...r, key: addrKey });
      else { setQuote(null); setQuoteErr(r.error); }
    }, 600);
    return () => clearTimeout(timer);
  }, [isDelivery, addrReady, underMin, addrKey, retry, addr, t.subtotal, form.name, form.phone]);

  if (!lines.length) return <div className="card">Your order is empty. <Link href="/menu">Browse the menu</Link></div>;

  const submit = async () => {
    setErr("");
    if (demoPayments && card.number.replace(/\s/g, "") !== "4242424242424242") return setErr("Demo site: use the test card (tap “Fill test card”).");
    setBusy(true);
    const r = await placeOrder({
      lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections, instructions: l.instructions })), ...form, tipPct,
      fulfillment: mode, deliveryQuoteRef: isDelivery ? quote?.quoteRef : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      if (/price expired/i.test(r.error)) setRetry((n) => n + 1); // fetch a fresh price
      return setErr(r.error);
    }
    trackOrder(r.orderId); // so this phone gets "started" / "ready" alerts
    cart.clear();
    if (r.redirectUrl) window.location.href = r.redirectUrl;
    else router.push(`/order/${r.orderId}`);
  };
  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });
  const a = (k: keyof typeof addr) => ({
    value: addr[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddr({ ...addr, [k]: k === "state" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value }),
  });
  const c = (k: keyof typeof card) => ({ value: card[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCard({ ...card, [k]: e.target.value }) });

  return (
    <div className="has-bar">
      {delivery && (
        <>
          <div className="seg-big" role="tablist">
            <button role="tab" aria-selected={!isDelivery} className={!isDelivery ? "on" : ""} onClick={() => setMode("pickup")}>🛍 Pickup<small>{pickupAddress.split(",")[0]}</small></button>
            <button role="tab" aria-selected={isDelivery} className={isDelivery ? "on" : ""} onClick={() => setMode("delivery")}>🚗 Delivery<small>by {delivery.by}</small></button>
          </div>
          {isDelivery && (
            <>
              <div className="sec">Deliver to</div>
              {underMin && <div className="warnbox" style={{ margin: "8px 16px" }}>Delivery needs a {money(delivery.minOrderCents)} minimum. Add {money(delivery.minOrderCents - t.subtotal)} more, or choose pickup.</div>}
              <div className="two">
                <label className="field"><span>Street address *</span><input {...a("street")} autoComplete="address-line1" placeholder="123 Main St" /></label>
                <label className="field"><span>Apt / suite</span><input {...a("unit")} autoComplete="address-line2" /></label>
              </div>
              <div className="three">
                <label className="field"><span>City *</span><input {...a("city")} autoComplete="address-level2" /></label>
                <label className="field"><span>State</span><input {...a("state")} autoComplete="address-level1" /></label>
                <label className="field"><span>ZIP *</span><input {...a("zip")} autoComplete="postal-code" inputMode="numeric" maxLength={5} /></label>
              </div>
              <label className="field"><span>Instructions for the driver</span><input {...a("instructions")} placeholder="Gate code, leave at door…" /></label>
              <div className="note">
                {quoting ? "Getting a delivery price…"
                  : quoteErr ? <><span style={{ color: "var(--bad)" }}>{quoteErr}</span> <button className="linkbtn" onClick={() => setRetry((n) => n + 1)}>Try again</button></>
                  : quoteCurrent ? `Delivery ${money(quote!.feeCents)} · arrives in about ${quote!.etaMinutes} min · driver by ${quote!.by}`
                  : addrReady ? "" : "Enter your address to see the delivery price."}
              </div>
            </>
          )}
        </>
      )}
      <div className="sec">Your details</div>
      <label className="field"><span>Name for the order *</span><input {...f("name")} autoComplete="name" /></label>
      <div className="two">
        <label className="field"><span>{isDelivery ? "Mobile (for your driver) *" : "Mobile (we text when ready) *"}</span><input {...f("phone")} type="tel" autoComplete="tel" /></label>
        <label className="field"><span>Email for receipt</span><input {...f("email")} type="email" autoComplete="email" /></label>
      </div>
      <label className="field"><span>Notes for the kitchen</span><input {...f("notes")} placeholder="Allergies, extra napkins…" /></label>

      <div className="sec">{isDelivery ? "Tip your driver" : "Tip the crew"}</div>
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
        {isDelivery && <div><span>Delivery</span><span>{quoteCurrent ? money(deliveryFee) : "—"}</span></div>}
        <div><span>Tip</span><span>{money(t.tip)}</span></div>
        <div className="grand"><span>Total</span><span>{money(total)}</span></div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="bar">
        <button className="btn" disabled={busy || !form.name || form.phone.length < 7 || (isDelivery && (!quoteCurrent || underMin))} onClick={submit}>
          <span>{busy ? "Placing order…" : isDelivery ? "Place delivery order" : "Place order"}</span><span>{money(total)}</span>
        </button>
      </div>
    </div>
  );
}
