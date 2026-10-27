import Link from "next/link";
import { KitchenBoard } from "@/components/KitchenBoard";
import { getKitchenOrders } from "@/server/queries";

export const metadata = { title: "Kitchen" };

export default async function AdminKitchen() {
  const orders = await getKitchenOrders();
  return (
    <>
      <div className="admin-top"><b>Kitchen</b><Link className="ibtn" href="/admin/menu">86 board</Link></div>
      <KitchenBoard initial={JSON.parse(JSON.stringify(orders))} />
    </>
  );
}
