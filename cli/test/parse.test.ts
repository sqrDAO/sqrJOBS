import { describe, expect, it } from "vitest";
import { checkDeadlineWindow, normalizeHandle, parseAmount, parseDeadline, parseStatus, readTextArg, UsageError } from "../src/parse.ts";

describe("parseAmount", () => {
  it("parses whole and fractional amounts into base units", () => {
    expect(parseAmount("5", 18)).toBe(5n * 10n ** 18n);
    expect(parseAmount("12.5", 18)).toBe(125n * 10n ** 17n);
    expect(parseAmount("0.000001", 6)).toBe(1n);
    expect(parseAmount(" 3 ", 6)).toBe(3_000_000n);
  });
  it("rejects zero, negatives, junk and excess decimals", () => {
    for (const bad of ["0", "0.0", "-1", "abc", "1e18", "", "1,000", "0x10"]) {
      expect(() => parseAmount(bad, 18), bad).toThrow(UsageError);
    }
    expect(() => parseAmount("0.0000001", 6)).toThrow(/6 decimals/);
  });
});

describe("parseDeadline", () => {
  const now = 1_800_000_000;
  it("parses relative offsets", () => {
    expect(parseDeadline("+3d", now)).toBe(BigInt(now + 3 * 86400));
    expect(parseDeadline("+12h", now)).toBe(BigInt(now + 12 * 3600));
    expect(parseDeadline("+90m", now)).toBe(BigInt(now + 90 * 60));
    expect(parseDeadline("+2D", now)).toBe(BigInt(now + 2 * 86400));
  });
  it("parses ISO dates as UTC unless an offset is given", () => {
    expect(parseDeadline("2026-12-01T12:00:00Z", now)).toBe(BigInt(Date.UTC(2026, 11, 1, 12) / 1000));
    expect(parseDeadline("2026-12-01T12:00", now)).toBe(BigInt(Date.UTC(2026, 11, 1, 12) / 1000));
    expect(parseDeadline("2026-12-01", now)).toBe(BigInt(Date.UTC(2026, 11, 1) / 1000));
    expect(parseDeadline("2026-12-01T19:00+07:00", now)).toBe(BigInt(Date.UTC(2026, 11, 1, 12) / 1000));
  });
  it("accepts unix seconds and rejects junk", () => {
    expect(parseDeadline("1800003600", now)).toBe(1_800_003_600n);
    for (const bad of ["tomorrow", "+0d", "+3w", "3d", "2026-13-45T00:00Z"]) {
      expect(() => parseDeadline(bad, now), bad).toThrow(UsageError);
    }
  });
  it("enforces the contract's 1 hour to 90 day window", () => {
    expect(() => checkDeadlineWindow(BigInt(now + 1800), now)).toThrow(/1 hour/);
    expect(() => checkDeadlineWindow(BigInt(now + 91 * 86400), now)).toThrow(/90 days/);
    expect(() => checkDeadlineWindow(BigInt(now + 3600), now)).not.toThrow();
  });
});

describe("normalizeHandle", () => {
  it("strips .ai and lowercases", () => {
    expect(normalizeHandle("Alice.AI")).toBe("alice");
    expect(normalizeHandle("bob")).toBe("bob");
    expect(normalizeHandle("  carol.ai ")).toBe("carol");
  });
  it("rejects empty and malformed handles", () => {
    for (const bad of [".ai", "", "a b.ai", "x.y.ai"]) expect(() => normalizeHandle(bad), bad).toThrow(UsageError);
  });
});

describe("parseStatus / readTextArg", () => {
  it("maps status names to the enum", () => {
    expect(parseStatus("open")).toBe(1);
    expect(parseStatus("Submitted")).toBe(3);
    expect(parseStatus("refunded")).toBe(6);
    expect(() => parseStatus("none")).toThrow(UsageError);
    expect(() => parseStatus("done")).toThrow(UsageError);
  });
  it("reads @file arguments", () => {
    expect(readTextArg("hello", "spec")).toBe("hello");
    expect(readTextArg("@spec.md", "spec", () => "from file\n")).toBe("from file");
    expect(() => readTextArg("@missing", "spec", () => { throw new Error("ENOENT"); })).toThrow(/Cannot read/);
    expect(() => readTextArg("  ", "spec")).toThrow(/empty/);
  });
});
