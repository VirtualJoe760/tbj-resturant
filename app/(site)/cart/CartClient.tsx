"use client";
import Link from "next/link";
import { cart, useCart } from "@/components/cart-store";
import { money, priceCart } from "@/domain/pricing";

export function CartClient({ taxRate }: { taxRate: number }) {
  const lines = useCart();
  if (!lines.length)
    return (
      <div className="card" style={{ textAlign: "center", marginTop: 24 }}>
        <div style={{ fontSize: 40 }}>🍕</div>
        <b>Your order is empty</b>
        <div className="mods">Build a pie, grab some wings.</div>
        <div style={{ marginTop: 12 }}><Link className="btn center" href="/menu">Browse the menu</Link></div>
      </div>
    );
  const t = priceCart(lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity })), { taxRate });
  return (
    <div className="has-bar">
      {lines.map((l) => (
        <div className="line" key={l.key}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <b>{l.emoji} {l.name}</b>
            <b>{money(l.unitCents * l.quantity)}</b>
          </div>
          {l.modifiers.length > 0 && <div className="mods">{l.modifiers.join(" · ")}</div>}
          {l.instructions && <div className="mods">“{l.instructions}”</div>}
          <div style={{ marginTop: 8 }} className="qty">
            <button onClick={() => cart.setQty(l.key, l.quantity - 1)} aria-label="Less">−</button>
            <b>{l.quantity}</b>
            <button onClick={() => cart.setQty(l.key, l.quantity + 1)} aria-label="More">+</button>
          </div>
        </div>
      ))}
      <div className="totals">
        <div><span>Subtotal</span><span>{money(t.subtotal)}</span></div>
        <div><span>Tax</span><span>{money(t.tax)}</span></div>
        <div className="grand"><span>Total before tip</span><span>{money(t.total)}</span></div>
      </div>
      <div className="chips"><Link href="/menu">+ Add more</Link><button onClick={() => cart.clear()}>Clear</button></div>
      <div className="bar"><Link className="btn" href="/checkout"><span>Checkout</span><span>{money(t.total)}</span></Link></div>
    </div>
  );
}
