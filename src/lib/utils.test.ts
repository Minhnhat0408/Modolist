import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("merges multiple classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    // tailwind-merge resolves conflicts: px-2 wins over px-4
    const result = cn("px-4", "px-2");
    expect(result).toBe("px-2");
  });

  it("deduplicates conflicting text colour classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, undefined, null as never, "bar")).toBe("foo bar");
  });

  it("handles conditional (object) syntax", () => {
    expect(cn({ "font-bold": true, italic: false })).toBe("font-bold");
  });

  it("handles array syntax", () => {
    expect(cn(["text-sm", "p-2"])).toBe("text-sm p-2");
  });

  it("returns empty string when no args given", () => {
    expect(cn()).toBe("");
  });

  it("merges responsive prefixes correctly", () => {
    const result = cn("md:px-4", "md:px-8");
    expect(result).toBe("md:px-8");
  });
});
