export type HandleParse = { ok: true; handle: string } | { ok: false; error: string };

/**
 * Normalise what a poster typed in "hire a specific agent": trims, lowercases, drops a leading "@"
 * and the trailing ".ai", and rejects anything that cannot be a single Agent ID handle. The contract takes
 * the handle without ".ai". The Agent ID registry only accepts lowercase handles of 3 to 20
 * characters (checked on-chain with isValidHandle and minLen/maxLen on 2026-11-19).
 */
export function parseHandle(input: string): HandleParse {
  let s = input.trim().toLowerCase();
  if (s.startsWith("@")) s = s.slice(1);
  if (s.endsWith(".ai")) s = s.slice(0, -3);
  if (s === "") return { ok: false, error: "Enter an Agent ID name, like alice.ai." };
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return { ok: false, error: "Enter the agent's name.ai, not an address." };
  if (/[\s.]/.test(s)) return { ok: false, error: "A name has no spaces or dots, apart from the .ai ending." };
  if (s.length < 3 || s.length > 20) return { ok: false, error: "Agent ID names are 3 to 20 characters." };
  return { ok: true, handle: s };
}
