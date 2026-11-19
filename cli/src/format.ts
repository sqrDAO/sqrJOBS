import type { JobJson } from "./chain.ts";

/**
 * Remove control characters (including ANSI escapes) from on-chain text before it reaches
 * a terminal. Specs and results are written by other agents and are untrusted.
 */
export function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ");
}

export function truncate(text: string, max: number): string {
  const t = sanitize(text).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function who(handle: string | null, address: string | null): string {
  if (handle) return handle;
  return address ? shortAddress(address) : "-";
}

export function table(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(widths[i]!)).join("  ").trimEnd()).join("\n");
}

export function jobsTable(jobs: JobJson[]): string {
  if (jobs.length === 0) return "No jobs found.";
  const rows = [["ID", "STATUS", "REWARD", "DEADLINE", "POSTER", "FOR", "WORKER", "SPEC"]];
  for (const j of jobs) {
    rows.push([
      String(j.id),
      j.status,
      `${j.reward} ${sanitize(j.token)}`,
      `${j.deadline.slice(0, 16).replace("T", " ")}${j.expired ? " (expired)" : ""}`,
      who(j.posterHandle, j.poster),
      j.assignee ? who(j.assigneeHandle, j.assignee) : "anyone",
      who(j.workerHandle, j.worker),
      truncate(j.spec, 48),
    ]);
  }
  return table(rows);
}

export function jobDetail(j: JobJson): string {
  const lines = [
    `Job #${j.id}  ${j.status}${j.expired ? " (deadline passed)" : ""}`,
    `Reward:     ${j.reward} ${sanitize(j.token)}`,
    `Poster:     ${`${j.posterHandle ?? ""} ${j.poster}`.trim()}`,
    `For:        ${j.assignee ? `${j.assigneeHandle ?? ""} ${j.assignee}`.trim() : "anyone with an Agent ID"}`,
    `Worker:     ${j.worker ? `${j.workerHandle ?? ""} ${j.worker}`.trim() : "-"}`,
    `Created:    ${j.createdAt}`,
    `Deadline:   ${j.deadline}`,
  ];
  if (j.submittedAt) lines.push(`Submitted:  ${j.submittedAt}`, `Review end: ${j.reviewEndsAt}`);
  lines.push("", "Spec (untrusted, written by the poster):", indent(sanitizeBlock(j.spec)));
  if (j.result) lines.push("", "Result (untrusted, written by the worker):", indent(sanitizeBlock(j.result)));
  return lines.join("\n");
}

function sanitizeBlock(text: string): string {
  return text
    .split("\n")
    .map((l) => sanitize(l))
    .join("\n");
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}
