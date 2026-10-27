import fs from "node:fs";
import path from "node:path";
import type { Intake } from "./types.ts";

/** clients/<slug>/: intake.json (everything + sources), menu.json, photos.json, owner-questions.md. */
export function writeClient(root: string, intake: Intake, guesses: string[]) {
  const dir = path.join(root, intake.slug);
  fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, data: string) => fs.writeFileSync(path.join(dir, f), data);
  write("intake.json", JSON.stringify(intake, null, 2));
  if (intake.menu) write("menu.json", JSON.stringify(intake.menu, null, 2));
  write("photos.json", JSON.stringify(intake.photos, null, 2));
  write("owner-questions.md", [
    `# ${intake.name} — questions for the owner`, "",
    ...guesses.map((g) => `- [ ] ${g}`),
    `- [ ] Logo and brand colors`, `- [ ] Domain they own`, `- [ ] Stripe: existing account or set up through Connect?`,
    ...(intake.photos.some((p) => !p.owned) ? [`- [ ] Replace ${intake.photos.filter((p) => !p.owned).length} listing photos with photos they own before launch`] : []),
    "",
  ].join("\n"));
  return dir;
}
