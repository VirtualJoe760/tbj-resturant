import { describe, expect, it } from "vitest";
import { FONTS } from "../../../src/domain/branding";
import { FONT_CHOICES, pickBanners } from "./theme.ts";

describe("theme", () => {
  it("offers the same fonts the app can load", () => {
    expect(FONT_CHOICES.map(([id]) => id)).toEqual(FONTS.map((f) => f.id));
  });
  it("puts the hero first and never a Google key in a banner URL", () => {
    expect(pickBanners([
      { source: "google", url: "https://places.googleapis.com/v1/places/a/photos/b/media", ref: "places/a/photos/b", owned: false, role: "gallery" },
      { source: "yelp", url: "https://s3-media.yelpcdn.com/x.jpg", owned: false, role: "hero" },
      { source: "website", url: "https://x.com/a.jpg?key=SECRET", owned: false },
    ])).toEqual(["https://s3-media.yelpcdn.com/x.jpg", "/api/places-photo?name=places/a/photos/b"]);
  });
});
