import { PageHero } from "@/components/PageHero";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getUser, landingFor } from "@/auth/session";
import { getDb, schema as s } from "@/db/client";
import { STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { money } from "@/domain/pricing";
import { SignOut } from "@/components/SignOut";
import { ReorderButton } from "./ReorderButton";
import { LiveOrderCard, LiveRefresh } from "./LiveOrders";
import { PushOptIn } from "@/components/PushOptIn";
import { COURIER_LABEL, type DeliveryRecord } from "@/domain/delivery";

const LIVE = ["pending_payment", "paid", "accepted", "preparing", "ready"];

/** One line for a live order on the dashboard: where it is and how far along. */
function liveView(o: { status: string; fulfillment: string; delivery: DeliveryRecord | null }) {
  const c = o.delivery?.status;
  if (o.fulfillment === "delivery" && c && ["picked_up", "at_dropoff"].includes(c)) return { label: COURIER_LABEL[c], detail: "Your driver has it", progress: 0.8 };
  if (o.status === "preparing") return { label: "Being made", detail: "The kitchen started your order", progress: 0.45 };
  if (o.status === "ready") return o.fulfillment === "delivery"
    ? { label: "Ready · waiting for the driver", detail: o.delivery?.courierName ? `${o.delivery.courierName} is on the way to pick it up` : "Packed and ready", progress: 0.65 }
    : { label: "Ready for pickup 🎉", detail: "Come grab it", progress: 1 };
  if (o.status === "pending_payment") return { label: "Waiting for payment", detail: "", progress: 0.05 };
  return { label: "Received", detail: "The kitchen will start it shortly", progress: 0.2 };
}

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getUser();
  if (!user)
    return (
      <>
        <PageHero page="account" title="Account">Sign in for order history and one-tap reorder</PageHero>
        <div style={{ margin: 16 }}><Link className="btn center" href="/login">Sign in or create an account</Link></div>
        <p className="note">No account needed to order — guest checkout works too.</p>
      </>
    );
  const db = await getDb();
  const orders = await db.select().from(s.orders).where(eq(s.orders.customerUserId, user.id)).orderBy(desc(s.orders.createdAt)).limit(20);
  const lines = orders.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orders.map((o) => o.id))) : [];
  const live = orders.filter((o) => LIVE.includes(o.status) || (o.fulfillment === "delivery" && o.delivery && ["assigned", "at_pickup", "picked_up", "at_dropoff"].includes(o.delivery.status)));
  const updates = orders.length ? await db.select().from(s.notifications).where(inArray(s.notifications.orderId, orders.map((o) => o.id))).orderBy(desc(s.notifications.createdAt)).limit(8) : [];
  const ago = (d: Date) => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return (
    <>
      <PageHero page="account" title={`Hi, ${user.name.split(" ")[0]}`}>Signed in as {user.email}</PageHero>
      {user.role !== "customer" && (
        <Link className="mrow" href={landingFor(user.role)}><span>🔑</span><div className="grow"><b>Go to your {user.role === "employee" ? "staff portal" : user.role === "kitchen" ? "kitchen screen" : "admin dashboard"}</b></div>›</Link>
      )}
      <LiveRefresh live={live.length > 0} />
      {live.length > 0 && (
        <>
          <div className="sec">Happening now</div>
          {live.map((o) => <LiveOrderCard key={o.id} id={o.id} number={o.number} {...liveView(o)} />)}
        </>
      )}
      <PushOptIn label="Get a phone notification when the kitchen starts and finishes my orders" />
      {updates.length > 0 && (
        <>
          <div className="sec">Updates</div>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            {updates.map((n) => (
              <Link key={n.id} className="row update" href={n.url ?? "/account"}>
                <div><b className={n.readAt ? "" : "unread"}>{n.title}</b>{n.body && <small>{n.body}</small>}</div>
                <span className="muted small">{ago(n.createdAt)}</span>
              </Link>
            ))}
          </div>
        </>
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
              <span className="kind">{o.fulfillment === "delivery" && o.delivery && ["picked_up", "at_dropoff", "delivered"].includes(o.delivery.status) ? COURIER_LABEL[o.delivery.status] : STATUS_LABEL[o.status as OrderStatus]}{o.fulfillment === "delivery" ? " · 🚗" : ""}</span>
              <ReorderButton lines={ls.map((l) => ({ itemId: l.itemId, name: l.nameSnapshot, quantity: l.quantity, unitCents: l.unitPriceCents, selections: l.selections as never, modifiers: l.modifiersText }))} />
            </div>
          </div>
        );
      })}
      <div className="sec">Settings</div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>

        <div className="row">Deals &amp; events email<span className="kind ok">On</span></div>
        <SignOut />
      </div>
    </>
  );
}
