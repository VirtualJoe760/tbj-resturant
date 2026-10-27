import { appIcon } from "@/server/app-icon";

// iPhone home-screen icon (iOS rounds the corners itself and needs an opaque background).
export const dynamic = "force-dynamic";
export const GET = () => appIcon(180, { opaque: true });
