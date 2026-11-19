import { formatUnits, parseUnits, type Address } from "viem";
import { ZERO_ADDRESS } from "./types.ts";

/** "0x1234…abcd" */
export function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** `name.ai` when the address holds an Agent ID, otherwise a shortened address. Empty for the zero address. */
export function displayName(addr: Address | string, handle?: string): string {
  if (handle) return `${handle}.ai`;
  if (!addr || addr.toLowerCase() === ZERO_ADDRESS) return "";
  return shortAddress(addr);
}

/** Token amount for display: grouped thousands, at most `maxDecimals` fractional digits, trailing zeros trimmed. */
export function formatAmount(value: bigint, decimals: number, maxDecimals = 2): string {
  const negative = value < 0n;
  const raw = formatUnits(negative ? -value : value, decimals);
  const [whole, frac = ""] = raw.split(".");
  const cut = frac.slice(0, maxDecimals).replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const tiny = value !== 0n && whole === "0" && cut === "";
  const out = tiny ? `<0.${"0".repeat(Math.max(0, maxDecimals - 1))}1` : cut ? `${grouped}.${cut}` : grouped;
  return negative ? `-${out}` : out;
}

/**
 * Parse what a user typed in an amount field. Returns null for anything that is not a plain positive
 * decimal with at most `decimals` fractional digits (no exponents, signs or thousands separators).
 */
export function parseAmount(input: string, decimals: number): bigint | null {
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const frac = s.split(".")[1] ?? "";
  if (frac.length > decimals) return null;
  try {
    const v = parseUnits(s, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

/** "3d 4h", "2h 5m", "45s": the two largest units of a duration in seconds. */
export function formatDuration(seconds: number): string {
  let s = Math.max(0, Math.floor(Math.abs(seconds)));
  const units: [string, number][] = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];
  const parts: string[] = [];
  for (const [label, size] of units) {
    if (s >= size || (label === "s" && parts.length === 0)) {
      parts.push(`${Math.floor(s / size)}${label}`);
      s %= size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 3 days", "2 hours ago", relative to `now` (both unix seconds). */
export function relativeTime(target: number, now: number): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Full local date and time for a unix timestamp, for `title` attributes and the timeline. */
export function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Value for an `<input type="datetime-local">` from unix seconds, in the browser's time zone. */
export function toDateTimeLocal(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Unix seconds from an `<input type="datetime-local">` value, or null if empty or invalid. */
export function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}
