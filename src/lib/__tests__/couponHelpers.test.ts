import { describe, it, expect } from "vitest";
import { passCategoryForPackageType } from "@/lib/couponHelpers";

describe("passCategoryForPackageType", () => {
  it("returns studio_pass for explicit studio type", () => {
    expect(passCategoryForPackageType({ type: "studio_pass" })).toBe("studio_pass");
    expect(passCategoryForPackageType({ type: "studio" })).toBe("studio_pass");
  });

  it("returns class_pass for explicit class type", () => {
    expect(passCategoryForPackageType({ type: "class_pass" })).toBe("class_pass");
    expect(passCategoryForPackageType({ type: "class" })).toBe("class_pass");
  });

  it("falls back to is_unlimited for legacy 'standard' rows", () => {
    expect(passCategoryForPackageType({ type: "standard", is_unlimited: true })).toBe("studio_pass");
    expect(passCategoryForPackageType({ type: "standard", is_unlimited: false })).toBe("class_pass");
  });

  it("defaults empty/null type to class_pass unless unlimited", () => {
    expect(passCategoryForPackageType({})).toBe("class_pass");
    expect(passCategoryForPackageType({ type: null, is_unlimited: null })).toBe("class_pass");
    expect(passCategoryForPackageType({ is_unlimited: true })).toBe("studio_pass");
  });
});
