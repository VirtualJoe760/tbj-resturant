import { stripeReady } from "@/payments/provider";
import { getDeliveryProvider } from "@/delivery/provider";
import { restaurant } from "@/config/restaurant";
import Link from "next/link";
import { getUser } from "@/auth/session";
import { STATUS_LABEL, type OrderStatus } from "@/domain/orders";
import { money } from "@/domain/pricing";
import { getDashboard, getLocation } from "@/server/queries";
import { StoreSwitch } from "./StoreSwitch";

export const metadata = { title: "Dashboard" };

export default async function AdminHome() {
  const [d, loc, user] = await Promise.all([getDashboard(), getLocation(), getUser()]);
  return (
    <>
      <div className="admin-top"><b>Dashboard</b><span className="muted small">{user?.role === "webmaster" ? "Webmaster" : "Owner"} · {user?.email}</span></div>
      <div className="kpis">
        <div className="kpi"><small>Sales (24h)</small><b>{money(d.sales)}</b></div>
        <div className="kpi"><small>Orders</small><b>{d.n}</b></div>
        <div className="kpi"><small>Avg ticket</small><b>{money(d.avg)}</b></div>
        <div className="kpi"><small>Phone orders</small><b>{d.voice}</b></div>
      </div>
      <Link className="mrow" href="/admin/requests"><span>📬</span><div className="grow"><b>{d.newRequests ? `${d.newRequests} new request${d.newRequests > 1 ? "s" : ""}` : "Requests inbox"}</b><small>Bands, private events, catering, job applications</small></div>{d.newRequests ? <i className="cnt">{d.newRequests}</i> : null}›</Link>
      <Link className="mrow" href="/admin/schedule"><span>🔁</span><div className="grow"><b>{d.coversClaimed ? `${d.coversClaimed} shift cover${d.coversClaimed > 1 ? "s" : ""} to approve` : d.coversOpen ? `${d.coversOpen} shift${d.coversOpen > 1 ? "s" : ""} looking for cover` : "No shift cover requests"}</b><small>Staff giving away or picking up shifts</small></div>›</Link>

      <div className="sec">Store</div>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <StoreSwitch flag="orderingPaused" label="Online ordering" value={!loc.orderingPaused} invert />
        <StoreSwitch flag="busy" label="Busy mode (+15 min pickup)" value={loc.busy} />
        {getDeliveryProvider() && <StoreSwitch flag="deliveryPaused" label={`Delivery (${getDeliveryProvider()!.label} drivers)`} value={!loc.deliveryPaused} invert />}
        <div className="row">Payments<span style={{ color: "var(--ok)", fontSize: 13 }}>● {stripeReady() ? "Stripe connected" : process.env.STRIPE_SECRET_KEY ? "Stripe key set · add the webhook to turn it on" : "Demo checkout (no Stripe keys yet)"}</span></div>
        <div className="row">Hours<span className="muted small">{loc.hoursSummary.join(" · ")}</span></div>
        {restaurant.delivery?.enabled && !getDeliveryProvider() && <div className="row">Delivery<span className="muted small">Add the {restaurant.delivery.provider === "uber" ? "Uber Direct" : "DoorDash Drive"} keys to turn it on</span></div>}
      </div>

      <div className="sec">Latest orders <Link href="/admin/orders">All →</Link></div>
      {d.recent.map((o) => (
        <div className="mrow" key={o.id}>
          <div className="grow"><b>#{o.number} · {o.customerName}</b><small>{o.channel} · {o.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>
          <span className="kind">{STATUS_LABEL[o.status as OrderStatus]}</span>
          <b>{money(o.totalCents)}</b>
        </div>
      ))}
    </>
  );
}
