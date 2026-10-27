// Runs before `next build` on Vercel: applies migrations and seeds an empty database,
// so the first visitor never waits on (or races) the setup.
import { ready } from "../src/db/client";

if (!process.env.DATABASE_URL) {
  console.log("setup-db: no DATABASE_URL, skipping (local runs use the embedded database)");
  process.exit(0);
}
ready().then(
  () => {
    console.log("setup-db: migrations applied, seed checked");
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
