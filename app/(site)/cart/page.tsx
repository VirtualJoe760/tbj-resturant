import { getLocation } from "@/server/queries";
import { CartClient } from "./CartClient";

export const metadata = { title: "Your order" };

export default async function CartPage() {
  const loc = await getLocation();
  return (
    <>
      <header className="top"><h1>Your order</h1><p>Pickup at {loc.address.split(",")[0]} · ~{loc.pickupLeadMinutes + (loc.busy ? 15 : 0)} min</p></header>
      <CartClient taxRate={loc.taxRate} />
    </>
  );
}
