import { describe, expect, it } from "vitest";
import { FONTS, STYLES } from "../../../src/domain/branding";
import { FONT_CHOICES, pickBanners, STYLE_CHOICES } from "./theme.ts";

describe("theme", () => {
  it("offers the same fonts the app can load", () => {
    expect(FONT_CHOICES.map(([id]) => id)).toEqual(FONTS.map((f) => f.id));
    expect(STYLE_CHOICES.map(([id]) => id)).toEqual(STYLES.map((s) => s.id));
  });
  it("puts the hero first and never a Google key in a banner URL", () => {
    expect(pickBanners([
      { source: "google", url: "https://places.googleapis.com/v1/places/a/photos/b/media", ref: "places/a/photos/b", owned: false, role: "gallery" },
      { source: "yelp", url: "https://s3-media.yelpcdn.com/x.jpg", owned: false, role: "hero" },
      { source: "website", url: "https://x.com/a.jpg?key=SECRET", owned: false },
    ])).toEqual(["https://s3-media.yelpcdn.com/x.jpg", "/api/places-photo?name=places/a/photos/b"]);
  });
});

describe("listing photos", () => {
  it("matches food photos to menu items by what they show", async () => {
    const { matchDishes, pickGallery } = await import("./theme.ts");
    const photos = matchDishes([
      { source: "yelp", url: "https://s3-media.yelpcdn.com/a.jpg", owned: false, role: "item", dish: "pepperoni pizza with hot honey drizzle" },
      { source: "yelp", url: "https://s3-media.yelpcdn.com/b.jpg", owned: false, role: "item", dish: "margherita pizza" },
      { source: "yelp", url: "https://s3-media.yelpcdn.com/c.jpg", owned: false, role: "item", dish: "garlic knots" },
      { source: "yelp", url: "https://s3-media.yelpcdn.com/d.jpg", owned: false, role: "menu" },
    ], ["Pepperoni & Hot Honey", "Margherita", "Meat Lovers"]);
    expect(photos.map((p) => p.itemName)).toEqual(["Pepperoni & Hot Honey", "Margherita", undefined, undefined]);
    // the gallery leaves out menu photos and banners, and credits listing photos
    const gallery = pickGallery(photos, ["https://s3-media.yelpcdn.com/a.jpg"]);
    expect(gallery.map((g) => g.src)).toEqual(["https://s3-media.yelpcdn.com/b.jpg", "https://s3-media.yelpcdn.com/c.jpg"]);
    expect(gallery[0].credit).toBe("Yelp");
  });
});
