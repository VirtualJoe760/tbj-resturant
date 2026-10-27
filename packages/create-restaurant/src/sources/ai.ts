// Claude reads menus (website text, PDF, photos) into our menu schema, and sorts photos.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { MenuSchema, type Menu, type Photo } from "../types.ts";

const MODEL = "claude-opus-5-5";

const MENU_INSTRUCTIONS = `Turn this restaurant menu into structured data.
- Prices in integer cents. If a price is missing, estimate a typical local price and list it in "guesses".
- Pizza and similar items: sizes become a required "choice" group; listed ingredients become a "removal" group (all is_default true) so callers can say "hold the sausage"; extra toppings become an "addon" group.
- Sauce or flavor picks (wings, dressings) are "choice" groups with min 1, max 1, first option is_default.
- Alcohol: orderable_online false, tag "21+".
- Keep the restaurant's own item names and category order. Short, plain descriptions.`;

type Block = Anthropic.ContentBlockParam;

function fileBlock(file: string): Block {
  const data = fs.readFileSync(file).toString("base64");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  const media = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: media, data } };
}

export async function readMenu(input: { text?: string; files?: string[]; urls?: string[] }): Promise<Menu> {
  const client = new Anthropic();
  const content: Block[] = [
    ...(input.files ?? []).map(fileBlock),
    ...(input.urls ?? []).map((url): Block => (url.endsWith(".pdf") ? { type: "document", source: { type: "url", url } } : { type: "image", source: { type: "url", url } })),
    { type: "text", text: `${MENU_INSTRUCTIONS}${input.text ? `\n\nMenu text:\n${input.text}` : ""}` },
  ];
  const stream = client.messages.stream({ model: MODEL, max_tokens: 64000, output_config: { effort: "medium", format: zodOutputFormat(MenuSchema) }, messages: [{ role: "user", content }] });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to read this menu");
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No menu came back");
  return MenuSchema.parse(JSON.parse(text.text));
}

const PhotoTags = z.object({
  photos: z.array(z.object({
    index: z.number().int(),
    role: z.enum(["hero", "item", "gallery", "event", "skip"]).describe("skip = blurry, dark, duplicate, or mostly a menu/sign"),
    item_name: z.string().describe("menu item shown, exactly as named in the list, or empty"),
    tags: z.array(z.string()),
    faces: z.boolean().describe("recognizable people in frame"),
    quality: z.number().int().describe("1-10"),
  })),
});

/** Tags each photo and picks spots: one hero, menu-item matches, gallery, events. */
export async function sortPhotos(photos: Photo[], itemNames: string[]): Promise<Photo[]> {
  if (!photos.length) return photos;
  const client = new Anthropic();
  const batch = photos.slice(0, 20);
  const content: Block[] = batch.flatMap((p, i): Block[] => [{ type: "text", text: `Photo ${i}:` }, { type: "image", source: { type: "url", url: p.url } }]);
  content.push({ type: "text", text: `These are photos of a restaurant. Menu items: ${itemNames.join("; ")}.\nFor each photo give its role (exactly one "hero": the best wide food or interior shot without recognizable faces), the menu item it shows if any, tags (food, drinks, interior, exterior, crowd, stage, logo), whether faces are recognizable, and a quality score.` });
  const msg = await client.messages.parse({ model: MODEL, max_tokens: 16000, output_config: { effort: "low", format: zodOutputFormat(PhotoTags) }, messages: [{ role: "user", content }] });
  const tags = msg.parsed_output?.photos ?? [];
  return batch.map((p, i) => {
    const t = tags.find((x) => x.index === i);
    if (!t) return p;
    return { ...p, role: t.role === "hero" && t.faces ? "gallery" : t.role, itemName: t.item_name || undefined, tags: t.tags };
  });
}
