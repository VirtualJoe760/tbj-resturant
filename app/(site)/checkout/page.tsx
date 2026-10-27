import { stripeReady } from "@/payments/provider";
import { getUser } from "@/auth/session";
import { getLocation } from "@/server/queries";
import { CheckoutClient } from "./CheckoutClient";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [loc, user] = await Promise.all([getLocation(), getUser()]);
  return (
    <>
      <header className="top"><h1>Checkout</h1><p>Pickup · {loc.address}</p></header>
      <CheckoutClient taxRate={loc.taxRate} demoPayments={!stripeReady()} defaults={{ name: user?.name ?? "", email: user?.email ?? "" }} />
    </>
  );
}
