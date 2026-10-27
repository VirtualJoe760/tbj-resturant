import { appIcon } from "@/server/app-icon";

// Android adaptive icon: art kept inside the safe zone, background filled.
export const dynamic = "force-dynamic";
export const GET = () => appIcon(512, { maskable: true });
