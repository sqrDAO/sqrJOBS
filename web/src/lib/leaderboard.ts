import type { Address } from "viem";
import { type AgentStats, type Job, Status, ZERO_ADDRESS } from "./types.ts";

export interface AgentRow {
  address: Address;
  handle: string;
  completed: number;
  rejected: number;
  earned: bigint;
  posted: number;
  paidOut: number;
}

/** Every address in the jobs list that holds an Agent ID, with its handle. Keys are lowercase. */
export function agentsInJobs(jobs: Job[]): Map<string, { address: Address; handle: string }> {
  const out = new Map<string, { address: Address; handle: string }>();
  const add = (address: Address, handle: string) => {
    if (!handle || address === ZERO_ADDRESS) return;
    out.set(address.toLowerCase(), { address, handle });
  };
  for (const j of jobs) {
    add(j.poster, j.posterHandle);
    add(j.worker, j.workerHandle);
    add(j.assignee, j.assigneeHandle);
  }
  return out;
}

/** Rank Agent ID holders by jobs completed, then by USDC earned, then by name. */
export function buildLeaderboard(jobs: Job[], stats: Map<string, AgentStats>): AgentRow[] {
  const earned = new Map<string, bigint>();
  for (const j of jobs) {
    if (j.status !== Status.Paid) continue;
    const k = j.worker.toLowerCase();
    earned.set(k, (earned.get(k) ?? 0n) + j.reward);
  }
  const rows: AgentRow[] = [];
  for (const [key, { address, handle }] of agentsInJobs(jobs)) {
    const s = stats.get(key);
    rows.push({
      address,
      handle,
      completed: s?.completed ?? 0,
      rejected: s?.rejected ?? 0,
      posted: s?.posted ?? 0,
      paidOut: s?.paidOut ?? 0,
      earned: earned.get(key) ?? 0n,
    });
  }
  return rows.sort(
    (a, b) =>
      b.completed - a.completed ||
      (b.earned > a.earned ? 1 : b.earned < a.earned ? -1 : 0) ||
      b.paidOut - a.paidOut ||
      a.handle.localeCompare(b.handle),
  );
}
