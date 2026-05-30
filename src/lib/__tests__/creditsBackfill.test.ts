import { describe, it, expect } from "vitest";
import { shouldBackfillCredits } from "@/lib/creditsBackfill";

describe("shouldBackfillCredits", () => {
  it("fills a class pass with null credits from classes_remaining", () => {
    const r = shouldBackfillCredits({
      credits_remaining: null,
      credits_total: null,
      classes_remaining: 8,
      package_type: { type: "class_pass", is_unlimited: false },
    });
    expect(r).toEqual({ credits_remaining: 8, credits_total: 8 });
  });

  it("preserves an existing credits_total when filling", () => {
    const r = shouldBackfillCredits({
      credits_remaining: null,
      credits_total: 10,
      classes_remaining: 4,
      package_type: { type: "class_pass", is_unlimited: false },
    });
    expect(r).toEqual({ credits_remaining: 4, credits_total: 10 });
  });

  it("leaves studio (unlimited) passes untouched", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: null,
        credits_total: null,
        classes_remaining: 99,
        package_type: { type: "studio_pass", is_unlimited: true },
      })
    ).toBeNull();
  });

  it("does nothing when credits_remaining is already set", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: 3,
        credits_total: 5,
        classes_remaining: 5,
        package_type: { type: "class_pass", is_unlimited: false },
      })
    ).toBeNull();
  });

  it("does nothing when there is no legacy classes_remaining to copy", () => {
    expect(
      shouldBackfillCredits({
        credits_remaining: null,
        credits_total: null,
        classes_remaining: null,
        package_type: { type: "class_pass", is_unlimited: false },
      })
    ).toBeNull();
  });
});
