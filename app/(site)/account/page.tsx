import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getUser, landingFor } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { money } from "@/domain/pricing";
import { SignOut } from "@/components/SignOut";
import { ReorderButton } from "./ReorderButton";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getUser();
  if (!user)
    return (
      <>
        <header className="top"><h1>Account</h1><p>Sign in for order history and one-tap reorder</p></header>
        <div style={{ margin: 16 }}><Link className="btn center" href="/login">Sign in or create an account</Link></div>
        <p className="note">No account needed to order — guest checkout works too.</p>
      </>
    );
  const db = await getDb();
  const orders = await db.select().from(s.orders).where(eq(s.orders.customerUserId, user.id)).orderBy(desc(s.orders.createdAt)).limit(20);
  const lines = orders.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orders.map((o) => o.id))) : [];
  return (
    <>
      <header className="top"><h1>Hi, {user.name.split(" ")[0]}</h1><p>Signed in as {user.email}</p></header>
      {user.role !== "customer" && (
        <Link className="mrow" href={landingFor(user.role)}><span>🔑</span><div className="grow"><b>Go to your {user.role === "employee" ? "staff portal" : user.role === "kitchen" ? "kitchen screen" : "admin dashboard"}</b></div>›</Link>
      )}
      <div className="sec">Recent orders</div>
      {orders.length === 0 && <p className="note">No orders yet. <Link href="/menu">Start one →</Link></p>}
      {orders.map((o) => {
        const ls = lines.filter((l) => l.orderId === o.id);
        return (
          <div className="line" key={o.id}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Link href={`/order/${o.id}`}><b>{o.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · #{o.number}</b></Link>
              <span>{money(o.totalCents)}</span>
            </div>
            <div className="mods">{ls.map((l) => `${l.quantity}× ${l.nameSnapshot}${l.modifiersText.length ? ` (${l.modifiersText.join(", ")})` : ""}`).join(" · ")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span className="kind">{STATUS_LABEL[o.status as OrderStatus]}</span>
              <ReorderButton lines={ls.map((l) => ({ itemId: l.itemId, name: l.nameSnapshot, quantity: l.quantity, unitCents: l.unitPriceCents, selections: l.selections as never, modifiers: l.modifiersText }))} />
            </div>
          </div>
        );
      })}
      <div className="sec">Settings</div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row">Order-ready texts<span className="kind ok">On</span></div>
        <div className="row">Deals &amp; events email<span className="kind ok">On</span></div>
        <SignOut />
      </div>
    </>
  );
}
