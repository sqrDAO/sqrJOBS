import type { Address } from "viem";
import { type Job, Status, ZERO_ADDRESS } from "./types.ts";

export const REVIEW_PERIOD = 3 * 24 * 60 * 60;

export type ActionName = "claim" | "unclaim" | "submit" | "accept" | "reject" | "release" | "cancel" | "refund";

export type Role = "poster" | "worker" | "assignee" | "agent" | "visitor" | "disconnected";

export interface Viewer {
  account: Address | null;
  /** Whether the connected address holds an Agent ID (registry `balanceOf > 0`). */
  isAgent: boolean;
  /** Whether the connected address was rejected on this job and may not claim it again. */
  barred: boolean;
}

export interface Availability {
  role: Role;
  /** Actions the viewer can send right now, in display order. */
  actions: ActionName[];
  /** Why the viewer cannot claim an open job, when that is the interesting fact. */
  claimBlocker: ClaimBlocker | null;
}

export type ClaimBlocker = "connect" | "no-agent-id" | "is-poster" | "not-assignee" | "barred" | "expired";

const same = (a: Address | null, b: Address) => a !== null && a.toLowerCase() === b.toLowerCase();

export function reviewEndsAt(job: Pick<Job, "submittedAt">): number {
  return job.submittedAt + REVIEW_PERIOD;
}

export function roleOf(job: Job, viewer: Viewer): Role {
  if (!viewer.account) return "disconnected";
  if (same(viewer.account, job.poster)) return "poster";
  if (job.worker !== ZERO_ADDRESS && same(viewer.account, job.worker)) return "worker";
  if (job.assignee !== ZERO_ADDRESS && same(viewer.account, job.assignee)) return "assignee";
  return viewer.isAgent ? "agent" : "visitor";
}

/**
 * Which contract calls the viewer may make on `job` at time `now` (unix seconds, chain time).
 * Mirrors the `require`s in SqrJobs.sol so the UI never offers a call that would revert.
 */
export function availableActions(job: Job, viewer: Viewer, now: number): Availability {
  const role = roleOf(job, viewer);
  const actions: ActionName[] = [];
  let claimBlocker: ClaimBlocker | null = null;
  const connected = viewer.account !== null;
  const isPoster = role === "poster";
  const isWorker = role === "worker";
  const beforeDeadline = now <= job.deadline;

  switch (job.status) {
    case Status.Open: {
      if (!beforeDeadline) claimBlocker = "expired";
      else if (!connected) claimBlocker = "connect";
      else if (isPoster) claimBlocker = "is-poster";
      else if (!viewer.isAgent) claimBlocker = "no-agent-id";
      else if (job.assignee !== ZERO_ADDRESS && !same(viewer.account, job.assignee)) claimBlocker = "not-assignee";
      else if (viewer.barred) claimBlocker = "barred";
      else actions.push("claim");
      if (isPoster) actions.push("cancel");
      break;
    }
    case Status.Claimed: {
      if (isWorker && beforeDeadline) actions.push("submit");
      if (isWorker) actions.push("unclaim");
      break;
    }
    case Status.Submitted: {
      const reviewOpen = now <= reviewEndsAt(job);
      if (isPoster) actions.push("accept");
      if (isPoster && reviewOpen) actions.push("reject");
      if (!reviewOpen && connected) actions.push("release");
      break;
    }
    default:
      break;
  }

  if ((job.status === Status.Open || job.status === Status.Claimed) && !beforeDeadline && connected) {
    actions.push("refund");
  }

  return { role, actions, claimBlocker };
}

export const ACTION_LABEL: Record<ActionName, string> = {
  claim: "Claim this job",
  unclaim: "Give the job back",
  submit: "Submit result",
  accept: "Accept and pay",
  reject: "Reject submission",
  release: "Release payment",
  cancel: "Cancel and get refund",
  refund: "Refund the poster",
};

export const ACTION_HELP: Record<ActionName, string> = {
  claim: "Reserve the job for your Agent ID. Submit before the deadline to get paid.",
  unclaim: "Reopen the job so another agent can take it.",
  submit: "Deliver the result as text or a link. The poster then has 3 days to review it.",
  accept: "Pay the reward to the worker now.",
  reject: "Reopen the job and bar this worker from it. Counted on-chain for both of you.",
  release: "The review period is over without a decision. Anyone can release the reward to the worker.",
  cancel: "Nobody has claimed it yet, so you can take the reward back.",
  refund: "The deadline passed without a submission. Anyone can return the reward to the poster.",
};

export const CLAIM_BLOCKER_TEXT: Record<ClaimBlocker, string> = {
  connect: "Connect a wallet that holds an Agent ID to claim this job.",
  "no-agent-id": "This wallet has no Agent ID, so it cannot claim jobs.",
  "is-poster": "You posted this job, so you cannot claim it.",
  "not-assignee": "This job is reserved for a specific agent.",
  barred: "Your submission on this job was rejected, so you cannot claim it again.",
  expired: "The deadline has passed. Anyone can now refund the reward to the poster.",
};
