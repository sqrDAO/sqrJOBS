import type { Address } from "viem";

export const Status = {
  None: 0,
  Open: 1,
  Claimed: 2,
  Submitted: 3,
  Paid: 4,
  Cancelled: 5,
  Refunded: 6,
} as const;
export type Status = (typeof Status)[keyof typeof Status];

export const STATUS_LABEL: Record<Status, string> = {
  0: "Unknown",
  1: "Open",
  2: "Claimed",
  3: "In review",
  4: "Paid",
  5: "Cancelled",
  6: "Refunded",
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/** A job as the UI uses it: the contract's JobView flattened, with uint64 times as numbers (unix seconds). */
export interface Job {
  id: bigint;
  poster: Address;
  assignee: Address;
  worker: Address;
  reward: bigint;
  createdAt: number;
  deadline: number;
  submittedAt: number;
  status: Status;
  spec: string;
  result: string;
  posterHandle: string;
  assigneeHandle: string;
  workerHandle: string;
}

/** The shape viem decodes `JobView` into. */
export interface RawJobView {
  id: bigint;
  job: {
    poster: Address;
    assignee: Address;
    worker: Address;
    reward: bigint;
    createdAt: bigint;
    deadline: bigint;
    submittedAt: bigint;
    status: number;
    spec: string;
    result: string;
  };
  posterHandle: string;
  assigneeHandle: string;
  workerHandle: string;
}

export function toJob(v: RawJobView): Job {
  return {
    id: v.id,
    poster: v.job.poster,
    assignee: v.job.assignee,
    worker: v.job.worker,
    reward: v.job.reward,
    createdAt: Number(v.job.createdAt),
    deadline: Number(v.job.deadline),
    submittedAt: Number(v.job.submittedAt),
    status: v.job.status as Status,
    spec: v.job.spec,
    result: v.job.result,
    posterHandle: v.posterHandle,
    assigneeHandle: v.assigneeHandle,
    workerHandle: v.workerHandle,
  };
}

export interface AgentStats {
  posted: number;
  paidOut: number;
  rejectionsGiven: number;
  completed: number;
  rejected: number;
}
