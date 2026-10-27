import { DemoBanner } from "@/components/DemoBanner";
import { restaurant } from "@/config/restaurant";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the team" };

export default function Join() {
  return (
    <>
      <DemoBanner />
      <div className="page no-tabs">
        <header className="top"><h1>Join the team</h1><p>{restaurant.name} · enter the code from your invite</p></header>
        <JoinForm />
      </div>
    </>
  );
}
