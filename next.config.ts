import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres ships WASM files that must not be bundled
  serverExternalPackages: ["@electric-sql/pglite"],
  // lets admin.localhost / kitchen.localhost / … each keep their own sign-in during demos
  allowedDevOrigins: ["*.localhost"],
};

export default nextConfig;
