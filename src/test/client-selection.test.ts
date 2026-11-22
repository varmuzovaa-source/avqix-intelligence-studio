import { describe, expect, it } from "vitest";
import { resolveClientIndex } from "@/lib/client-selection";
describe("client selection across reloads", () => {
  it("keeps the saved client after reordering", () => {
    expect(resolveClientIndex("Test AVQIX", ["Demo", "Test AVQIX"])).toBe(1);
    expect(resolveClientIndex("Test AVQIX", ["Test AVQIX", "Demo"])).toBe(0);
  });
  it("prefers an own client when no selection exists or the saved client was removed", () => {
    expect(resolveClientIndex(null, ["Demo", "Own"], "Own")).toBe(1);
    expect(resolveClientIndex("Removed", ["Demo", "Own"], "Own")).toBe(1);
    expect(resolveClientIndex("Removed", ["Demo"])).toBe(0);
  });
});
