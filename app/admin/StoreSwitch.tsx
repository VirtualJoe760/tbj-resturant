"use client";
import { useOptimistic, useTransition } from "react";
import { setStoreFlag } from "@/server/actions/admin";
import { toast } from "@/components/Toast";

// `invert`: the switch shows "on" when the stored flag is false (e.g. Online ordering = !orderingPaused).
export function StoreSwitch({ flag, label, value, invert }: { flag: "busy" | "orderingPaused"; label: string; value: boolean; invert?: boolean }) {
  const [on, setOn] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div className="row">
      {label}
      <button className={`switch ${on ? "" : "off"}`} aria-label={label} onClick={() => start(async () => {
        setOn(!on);
        await setStoreFlag(flag, invert ? on : !on);
        toast(`${label}: ${!on ? "on" : "off"}`);
      })} />
    </div>
  );
}
