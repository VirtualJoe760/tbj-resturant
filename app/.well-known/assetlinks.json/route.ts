import { restaurant } from "@/config/restaurant";

// Proves to Android that the Play Store app and this website belong together, so the app opens
// the site full-screen with no browser bar (Trusted Web Activity). See docs/16-app-stores.md.
export function GET() {
  const a = restaurant.app;
  const body = a?.androidPackage && a.androidSha256?.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: a.androidPackage, sha256_cert_fingerprints: a.androidSha256 } }]
    : [];
  return Response.json(body);
}
