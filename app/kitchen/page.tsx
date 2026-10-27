import { KitchenBoard } from "@/components/KitchenBoard";
import { SignOut } from "@/components/SignOut";
import { getKitchenOrders, getLocation } from "@/server/queries";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  const [orders, loc] = await Promise.all([getKitchenOrders(), getLocation()]);
  return (
    <>
      <div className="admin-top">
        <b>Kitchen · {loc.name}</b>
        <div className="actions">
          <span className={`kind ${loc.orderingPaused ? "new" : "ok"}`}>{loc.orderingPaused ? "Ordering paused" : loc.busy ? "Busy +15" : "Open"}</span>
          <SignOut className="ibtn" label="Sign out" />
        </div>
      </div>
      <KitchenBoard initial={JSON.parse(JSON.stringify(orders))} />
    </>
  );
}
