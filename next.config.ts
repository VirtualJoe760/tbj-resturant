import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres ships WASM files that must not be bundled
  serverExternalPackages: ["@electric-sql/pglite"],
  // lets admin.localhost / kitchen.localhost / … each keep their own sign-in during demos
  allowedDevOrigins: ["*.localhost"],
  // migrations are read from disk at runtime, and the embedded DB loads its WASM files from disk
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./node_modules/@electric-sql/pglite/dist/**/*"] },
};

export default nextConfig;
