"use client";
import { useRouter } from "next/navigation";
import { cart } from "@/components/cart-store";
import type { Selections } from "@/domain/pricing";

export function ReorderButton({ lines }: { lines: { itemId: string; name: string; quantity: number; unitCents: number; selections: Selections; modifiers: string[] }[] }) {
  const router = useRouter();
  return (
    <button
      className="ibtn primary"
      onClick={() => {
        // prices are re-checked on the server at checkout
        for (const l of lines) cart.add({ ...l, emoji: "🔁" });
        router.push("/cart");
      }}
    >
      Reorder
    </button>
  );
}
