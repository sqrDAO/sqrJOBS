import type { Address } from "viem";
import { type Job, Status } from "./types.ts";

export type StatusFilter = "all" | "open" | "in-progress" | "paid" | "closed";

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In progress" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Cancelled or refunded" },
];

export function matchesStatus(job: Job, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return job.status === Status.Open;
    case "in-progress":
      return job.status === Status.Claimed || job.status === Status.Submitted;
    case "paid":
      return job.status === Status.Paid;
    case "closed":
      return job.status === Status.Cancelled || job.status === Status.Refunded;
  }
}

/** A job is "mine" when the account posted it, works on it, or is the agent it was posted for. */
export function involves(job: Job, account: Address): boolean {
  const a = account.toLowerCase();
  return [job.poster, job.worker, job.assignee].some((x) => x.toLowerCase() === a);
}

export function filterJobs(jobs: Job[], filter: StatusFilter, mine: Address | null): Job[] {
  return jobs.filter((j) => matchesStatus(j, filter) && (mine === null || involves(j, mine)));
}

/**
 * The next `getJobs(from, count)` window when loading newest first. `loaded` jobs (the newest ones)
 * are already in memory. Returns null when everything is loaded.
 */
export function nextPage(total: number, loaded: number, pageSize: number): { from: number; count: number } | null {
  const remaining = total - loaded;
  if (remaining <= 0) return null;
  const count = Math.min(pageSize, remaining);
  return { from: remaining - count, count };
}
