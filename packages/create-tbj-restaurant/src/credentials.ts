import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Our account keys (Google Places, Yelp, Anthropic, Vercel…). Read from the environment
// first, then from a per-user file outside any repo with owner-only permissions.
// `create-tbj-restaurant login` writes it through hidden prompts — keys never go in chat or git.
// (folder name kept from the old package name so saved keys keep working)
const FILE = path.join(os.homedir(), ".config", "create-restaurant", "credentials.json");

export const KEYS = {
  GOOGLE_PLACES_API_KEY: "Google Places API key (business info + photos)",
  YELP_API_KEY: "Yelp API key (optional, paid after trial)",
  ANTHROPIC_API_KEY: "Anthropic API key (menu + photo reading)",
  VERCEL_TOKEN: "Vercel token (deploys demo sites)",
} as const;
export type KeyName = keyof typeof KEYS;

function readFile(): Partial<Record<KeyName, string>> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export function getKey(name: KeyName): string | undefined {
  return process.env[name] || readFile()[name] || undefined;
}

export function saveKeys(values: Partial<Record<KeyName, string>>) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const merged = { ...readFile(), ...Object.fromEntries(Object.entries(values).filter(([, v]) => v)) };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return FILE;
}

export const keyStatus = () => Object.fromEntries((Object.keys(KEYS) as KeyName[]).map((k) => [k, !!getKey(k)])) as Record<KeyName, boolean>;
