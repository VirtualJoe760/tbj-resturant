// `npx create-tbj-resturant [folder]`: a brand-new restaurant app. Copies the template from GitHub,
// installs it, runs the questionnaire inside it (menu, menu times, look, delivery…), loads the
// local database, commits, and optionally makes a private GitHub repo ready for Vercel.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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

/** Runs a command without blocking, so spinners keep moving. Input is closed: it can never wait on a prompt. */
function runAsync(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: win && (cmd === "pnpm" || cmd === "npx"), env: { ...process.env, CI: "true" } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
    child.on("error", (e) => resolve({ code: 1, out: String(e) }));
  });
}

/** Copies the template into `dir` (a clean project: no history, no other restaurant's files). */
export async function copyTemplate(dir: string, template = TEMPLATE) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} already exists and isn't empty`);
  if (!has("git")) throw new Error("Git isn't installed: get it from https://git-scm.com and try again");
  const spin = p.spinner();
  spin.start("Copying the restaurant template");
  const clone = await runAsync("git", ["clone", "--depth", "1", template, dir], process.cwd());
  if (clone.code !== 0) {
    spin.stop("Couldn't copy the template", 1);
    throw new Error(clone.out || "git clone failed");
  }
  fs.rmSync(path.join(dir, ".git"), { recursive: true, force: true });
  fs.rmSync(path.join(dir, "public", "brand"), { recursive: true, force: true });
  const clients = path.join(dir, "clients");
  for (const f of fs.existsSync(clients) ? fs.readdirSync(clients) : []) if (f !== ".gitkeep") fs.rmSync(path.join(clients, f), { recursive: true, force: true });
  spin.stop("Template copied");
}

/** Starts installing in the background; `finish()` waits for it with a live timer. */
export function startInstall(dir: string) {
  const started = Date.now();
  const pnpm = has("pnpm") ? (["pnpm", []] as const) : (["npx", ["-y", "pnpm@9"]] as const);
  let result: { code: number; out: string } | null = null;
  const job = runAsync(pnpm[0], [...pnpm[1], "install", "--config.confirmModulesPurge=false"], dir).then((r) => (result = r));
  return {
    async finish() {
      const spin = p.spinner();
      const secs = () => Math.round((Date.now() - started) / 1000);
      spin.start("Finishing the install");
      const tick = setInterval(() => spin.message(`Finishing the install (${secs()}s, usually under 2 minutes)`), 1000);
      await job;
      clearInterval(tick);
      if (result!.code !== 0) {
        spin.stop("Install failed", 1);
        throw new Error(result!.out.split("\n").slice(-15).join("\n"));
      }
      spin.stop(`Installed (${secs()}s)`);
    },
  };
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

/** Adds NAME=value to the app's .env.local (git-ignored) unless it's already there. Never printed. */
export function ensureEnv(root: string, name: string, value: string) {
  const file = path.join(root, ".env.local");
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (new RegExp(`^${name}=.+`, "m").test(cur)) return false;
  const sep = cur && !cur.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(file, `${cur}${sep}${name}=${value}\n`);
  return true;
}
