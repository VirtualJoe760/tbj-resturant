import { describe, expect, it } from "vitest";
import { configSource } from "./apply.ts";
import type { Intake } from "./types.ts";

const base: Intake = { slug: "johns-diner", name: "John's Diner", city: "Indio, CA", timezone: "America/Los_Angeles", links: {}, photos: [], features: {}, sources: {}, createdAt: "2026-10-27" };

describe("configSource", () => {
  it("writes delivery settings and the Android app id", () => {
    const src = configSource({ ...base, delivery: { enabled: true, provider: "uber", customerFee: 299, minOrderCents: 2000 } });
    expect(src).toContain(`delivery: { enabled: true, provider: "uber", customerFee: 299, minOrderCents: 2000 },`);
    expect(src).toContain(`app: { androidPackage: "com.johnsdiner.app" }`);
  });
  it("leaves delivery out for pickup-only restaurants", () => {
    expect(configSource(base)).not.toContain("delivery:");
  });
});
