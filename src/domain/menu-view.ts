// Shape of the menu the server hands to the client menu page (kept out of server-only modules).
import type { ItemDef } from "./pricing";

export interface MenuItemView {
  id: string;
  name: string;
  description: string;
  emoji: string;
  imageUrl: string | null;
  tags: string[];
  basePriceCents: number;
  orderableOnline: boolean;
  soldOut: boolean;
  def: ItemDef;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
  isVisible: boolean;
  items: MenuItemView[];
}
