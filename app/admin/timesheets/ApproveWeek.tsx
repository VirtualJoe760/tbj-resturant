"use client";
import { useTransition } from "react";
import { toast } from "@/components/Toast";
import { approveTimesheets } from "@/server/actions/admin";

export function ApproveWeek({ ids, gusto }: { ids: string[]; gusto: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="chips">
      <button className="on" disabled={pending} onClick={() => start(async () => { await approveTimesheets(ids); toast("Week approved — ready for payroll"); })}>Approve week</button>
      <button disabled={!gusto} title={gusto ? "" : "Optional: connect Gusto in Settings → Payroll"} onClick={() => toast("Hours sent to Gusto")}>Send to Gusto{gusto ? "" : " (optional)"}</button>
    </div>
  );
}
