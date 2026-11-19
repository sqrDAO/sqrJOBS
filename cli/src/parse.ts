import { readFileSync } from "node:fs";
import { getAddress, isAddress, parseUnits, type Address } from "viem";
import { MAX_DURATION_SECONDS, MIN_DURATION_SECONDS, STATUS_NAMES, type StatusName } from "./config.ts";

/** A mistake in the command line. Printed as-is, exit code 2. */
export class UsageError extends Error {
  override name = "UsageError";
}

/** Parse a human token amount ("5", "12.5") into base units. Rejects zero, negatives and excess decimals. */
export function parseAmount(input: string, decimals: number): bigint {
  const s = input.trim();
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) {
    throw new UsageError(`Invalid amount "${input}". Use a plain number such as 5 or 12.5.`);
  }
  const frac = s.includes(".") ? s.slice(s.indexOf(".") + 1) : "";
  if (frac.length > decimals) {
    throw new UsageError(`Invalid amount "${input}": the token has only ${decimals} decimals.`);
  }
  const value = parseUnits(s.endsWith(".") ? s.slice(0, -1) : s, decimals);
  if (value === 0n) throw new UsageError("The amount must be greater than zero.");
  return value;
}

const UNIT_SECONDS: Record<string, number> = { m: 60, h: 3600, d: 86400 };

/**
 * Parse a deadline into unix seconds. Accepts a relative offset (`+3d`, `+12h`, `+90m`),
 * an ISO date or date-time (UTC unless it carries an offset), or unix seconds.
 */
export function parseDeadline(input: string, nowSeconds: number): bigint {
  const s = input.trim();
  const rel = /^\+(\d+)([mhd])$/i.exec(s);
  if (rel) {
    const n = Number(rel[1]);
    if (n <= 0) throw new UsageError(`Invalid deadline "${input}": the offset must be positive.`);
    return BigInt(nowSeconds + n * UNIT_SECONDS[rel[2]!.toLowerCase()]!);
  }
  if (/^\d{9,11}$/.test(s)) return BigInt(s);
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i.test(s)) {
    let iso = s.replace(" ", "T");
    if (iso.includes("T") && !/(Z|[+-]\d{2}:?\d{2})$/i.test(iso)) iso += "Z";
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) throw new UsageError(`Invalid deadline "${input}".`);
    return BigInt(Math.floor(ms / 1000));
  }
  throw new UsageError(`Invalid deadline "${input}". Use +3d, +12h, +90m, an ISO date-time such as 2026-12-01T12:00Z, or unix seconds.`);
}

/** Check a deadline against the contract's 1 hour to 90 days window. */
export function checkDeadlineWindow(deadline: bigint, nowSeconds: number): void {
  const min = BigInt(nowSeconds + MIN_DURATION_SECONDS);
  const max = BigInt(nowSeconds + MAX_DURATION_SECONDS);
  if (deadline < min) throw new UsageError("The deadline must be at least 1 hour from now.");
  if (deadline > max) throw new UsageError("The deadline must be at most 90 days from now.");
}

/** "Alice.AI" -> "alice". The contract and registry take handles without ".ai". */
export function normalizeHandle(input: string): string {
  let h = input.trim().toLowerCase();
  if (h.endsWith(".ai")) h = h.slice(0, -3);
  if (h.length === 0 || /\s|\./.test(h)) throw new UsageError(`Invalid Agent ID handle "${input}". Use the form name.ai.`);
  return h;
}

/** "alice" -> "alice.ai"; empty stays null. */
export function displayHandle(handle: string): string | null {
  return handle ? `${handle}.ai` : null;
}

export function looksLikeHandle(input: string): boolean {
  return /\.ai$/i.test(input.trim());
}

export function parseAddress(input: string | undefined, what: string): Address {
  if (!input) throw new UsageError(`Missing ${what}.`);
  if (!isAddress(input, { strict: false })) throw new UsageError(`Invalid ${what} "${input}": expected a 0x address.`);
  return getAddress(input);
}

export function parseJobId(input: string | undefined): bigint {
  if (input === undefined || !/^\d+$/.test(input)) throw new UsageError(`Invalid job id "${input ?? ""}": expected a number such as 0 or 12.`);
  return BigInt(input);
}

export function parseStatus(input: string): number {
  const i = STATUS_NAMES.findIndex((n) => n.toLowerCase() === input.trim().toLowerCase());
  if (i <= 0) {
    throw new UsageError(`Unknown status "${input}". Use one of: ${STATUS_NAMES.slice(1).map((n) => n.toLowerCase()).join(", ")}.`);
  }
  return i;
}

export function statusName(status: number): StatusName {
  return STATUS_NAMES[status] ?? "None";
}

/** `--spec "text"` or `--spec @path/to/file`. */
export function readTextArg(input: string | undefined, what: string, readFile: (p: string) => string = (p) => readFileSync(p, "utf8")): string {
  if (input === undefined) throw new UsageError(`Missing --${what}.`);
  let text = input;
  if (input.startsWith("@")) {
    const path = input.slice(1);
    try {
      text = readFile(path).replace(/\s+$/, "");
    } catch {
      throw new UsageError(`Cannot read --${what} file "${path}".`);
    }
  }
  if (text.trim().length === 0) throw new UsageError(`--${what} is empty.`);
  return text;
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
