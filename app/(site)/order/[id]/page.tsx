import { notFound } from "next/navigation";
import { getOrder } from "@/server/queries";
import { OrderStatusClient } from "./OrderStatusClient";

export const metadata = { title: "Order status" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const order = await getOrder((await params).id);
  if (!order) notFound();
  return <OrderStatusClient initial={JSON.parse(JSON.stringify(order))} />;
}
