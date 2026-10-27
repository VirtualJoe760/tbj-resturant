// `npx create-tbj-resturant [folder]`: a brand-new restaurant app. Copies the template from GitHub,
// installs it, runs the questionnaire inside it (menu, menu times, look, delivery…), loads the
// local database, commits, and optionally makes a private GitHub repo ready for Vercel.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";

export const TEMPLATE = "https://github.com/VirtualJoe760/tbj-resturant.git";
const win = process.platform === "win32";

// git and gh are real programs; pnpm and npx are .cmd scripts on Windows and need a shell (which
// would split an argument like a commit message at its spaces, so only they get one).
const run = (cmd: string, args: string[], cwd: string, quiet = true) =>
  spawnSync(cmd, args, { cwd, stdio: quiet ? "pipe" : "inherit", shell: win && (cmd === "pnpm" || cmd === "npx"), encoding: "utf8" });

const has = (cmd: string, args = ["--version"]) => run(cmd, args, process.cwd()).status === 0;

/** Folder name for a restaurant: "John's Diner" → "johns-diner". */
export const folderName = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Copies the template into `dir` and installs it. Returns the app root. */
export function copyTemplate(dir: string, template = TEMPLATE) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} already exists and isn't empty`);
  if (!has("git")) throw new Error("Git isn't installed: get it from https://git-scm.com and try again");
  const spin = p.spinner();
  spin.start("Copying the restaurant template");
  const clone = run("git", ["clone", "--depth", "1", template, dir], process.cwd());
  if (clone.status !== 0) {
    spin.stop("Couldn't copy the template", 1);
    throw new Error(clone.stderr || "git clone failed");
  }
  // a fresh project: no template history, no other restaurant's files
  fs.rmSync(path.join(dir, ".git"), { recursive: true, force: true });
  fs.rmSync(path.join(dir, "public", "brand"), { recursive: true, force: true });
  const clients = path.join(dir, "clients");
  for (const f of fs.existsSync(clients) ? fs.readdirSync(clients) : []) if (f !== ".gitkeep") fs.rmSync(path.join(clients, f), { recursive: true, force: true });
  spin.stop("Template copied");

  spin.start("Installing (a minute or two the first time)");
  const pnpm = has("pnpm") ? ["pnpm", []] as const : ["npx", ["-y", "pnpm@9"]] as const;
  const install = run(pnpm[0], [...pnpm[1], "install"], dir);
  if (install.status !== 0) {
    spin.stop("Install failed", 1);
    throw new Error((install.stderr || install.stdout || "").split("\n").slice(-15).join("\n"));
  }
  spin.stop("Installed");
  return dir;
}

/** First commit, and a private GitHub repo when the GitHub CLI is signed in and the user agrees. */
export async function finishProject(dir: string, name: string, slug: string, ask: boolean) {
  run("git", ["init", "-b", "main"], dir);
  run("git", ["add", "-A"], dir);
  run("git", ["commit", "-m", `New restaurant app: ${name}`], dir);
  let repo = "";
  if (ask && has("gh", ["auth", "status"])) {
    const yes = await p.confirm({ message: `Create a private GitHub repo "${slug}" and push it? (needed for Vercel)` });
    if (yes === true) {
      const r = run("gh", ["repo", "create", slug, "--private", "--source", ".", "--push"], dir);
      repo = r.status === 0 ? (r.stdout.match(/https:\/\/github\.com\/\S+/)?.[0] ?? slug) : "";
      if (!repo) p.log.warn(`GitHub repo not created: ${(r.stderr || "").trim().split("\n").pop()}`);
    }
  }
  return repo;
}

export function nextSteps(dir: string, repo: string) {
  const rel = path.relative(process.cwd(), dir) || ".";
  return [
    `cd ${rel}`,
    "pnpm dev                      → http://localhost:3000 (test accounts are on /login)",
    "",
    repo
      ? `Put it online: vercel.com/new → import ${repo.replace("https://github.com/", "")} → Deploy,\nthen Storage → Neon to add its database (about 5 minutes, free).`
      : "Put it online: push to a GitHub repo, then vercel.com/new → import it → Deploy,\nthen Storage → Neon to add its database.",
    "",
    "Change the look any time in src/config/business-theme.ts (images in public/brand/).",
  ].join("\n");
}
