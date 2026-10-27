import { stripeReady } from "@/payments/provider";
import { restaurant } from "@/config/restaurant";
import { getDeliveryProvider } from "@/delivery/provider";
import { parseOneLine } from "@/domain/delivery";
import { getUser } from "@/auth/session";
import { getLocation } from "@/server/queries";
import { CheckoutClient } from "./CheckoutClient";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [loc, user] = await Promise.all([getLocation(), getUser()]);
  const provider = getDeliveryProvider();
  const here = parseOneLine(loc.address);
  const delivery = provider && !loc.deliveryPaused && restaurant.delivery
    ? { by: provider.label, minOrderCents: restaurant.delivery.minOrderCents, state: here?.state ?? "CA", city: here?.city ?? "" }
    : null;
  return (
    <>
      <header className="top"><h1>Checkout</h1><p>{delivery ? "Pickup or delivery" : `Pickup · ${loc.address}`}</p></header>
      <CheckoutClient taxRate={loc.taxRate} demoPayments={!stripeReady()} defaults={{ name: user?.name ?? "", email: user?.email ?? "" }} delivery={delivery} pickupAddress={loc.address} />
    </>
  );
}
