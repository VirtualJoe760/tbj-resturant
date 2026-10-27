"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "@/components/Toast";
import { clock } from "@/server/actions/staff";

function where(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 6000, maximumAge: 60000 });
  });
}

export function ClockClient({ state, since, place }: { state: "off" | "on" | "on_break"; since: string | null; place: string }) {
  const [now, setNow] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, []);
  const act = (a: "in" | "out" | "break_start" | "break_end") =>
    start(async () => {
      const pos = a === "in" ? await where() : null;
      const r = await clock(a, pos);
      toast(r.message);
      router.refresh();
    });
  return (
    <div className="clockcard">
      <div className="now">{now}</div>
      <div style={{ marginTop: 4, opacity: 0.85 }}>{state === "off" ? "You're off the clock" : state === "on_break" ? "On break — clock is paused" : `On the clock since ${since}`}</div>
      <div style={{ fontSize: 12, marginTop: 10, color: "#86efac" }}>📍 Clock-in checks you&apos;re at {place}</div>
      {state === "off" ? (
        <button className="bigbtn in" disabled={pending} onClick={() => act("in")}>{pending ? "Checking location…" : "Clock in"}</button>
      ) : (
        <>
          <button className="bigbtn brk" disabled={pending} onClick={() => act(state === "on_break" ? "break_end" : "break_start")}>{state === "on_break" ? "End break" : "Start break"}</button>
          <button className="bigbtn out" disabled={pending} onClick={() => act("out")}>Clock out</button>
        </>
      )}
    </div>
  );
}
