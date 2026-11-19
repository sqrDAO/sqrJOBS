import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { availableActions, REVIEW_PERIOD, roleOf, type Viewer } from "./actions.ts";
import { filterJobs, nextPage } from "./board.ts";
import {
  displayName,
  formatAmount,
  formatDuration,
  fromDateTimeLocal,
  parseAmount,
  relativeTime,
  shortAddress,
  toDateTimeLocal,
} from "./format.ts";
import { parseHandle } from "./handle.ts";
import { buildLeaderboard } from "./leaderboard.ts";
import { type AgentStats, type Job, Status, ZERO_ADDRESS } from "./types.ts";

const POSTER = "0x1111111111111111111111111111111111111111" as Address;
const WORKER = "0x2222222222222222222222222222222222222222" as Address;
const OTHER = "0x3333333333333333333333333333333333333333" as Address;
const NOW = 1_800_000_000;
const E18 = 10n ** 18n;

function job(over: Partial<Job> = {}): Job {
  return {
    id: 0n,
    poster: POSTER,
    assignee: ZERO_ADDRESS,
    worker: ZERO_ADDRESS,
    reward: 5n * E18,
    createdAt: NOW - 100,
    deadline: NOW + 86400,
    submittedAt: 0,
    status: Status.Open,
    spec: "Translate this",
    result: "",
    posterHandle: "",
    assigneeHandle: "",
    workerHandle: "",
    ...over,
  };
}

const viewer = (account: Address | null, isAgent = true, barred = false): Viewer => ({ account, isAgent, barred });

describe("formatAmount / parseAmount", () => {
  it("formats 18-decimal USDC", () => {
    expect(formatAmount(1234n * E18 + E18 / 2n, 18)).toBe("1,234.5");
    expect(formatAmount(5n * E18, 18)).toBe("5");
    expect(formatAmount(0n, 18)).toBe("0");
    expect(formatAmount(1n, 18)).toBe("<0.01");
  });
  it("formats 6-decimal tokens", () => {
    expect(formatAmount(1_500_000n, 6)).toBe("1.5");
  });
  it("parses plain decimals only", () => {
    expect(parseAmount("12.5", 18)).toBe(125n * 10n ** 17n);
    expect(parseAmount(" 3 ", 6)).toBe(3_000_000n);
    expect(parseAmount("0", 18)).toBeNull();
    expect(parseAmount("-1", 18)).toBeNull();
    expect(parseAmount("1e3", 18)).toBeNull();
    expect(parseAmount("1,000", 18)).toBeNull();
    expect(parseAmount("1.1234567", 6)).toBeNull();
    expect(parseAmount(".", 18)).toBeNull();
  });
});

describe("names and times", () => {
  it("shows name.ai or a short address", () => {
    expect(displayName(POSTER, "alice")).toBe("alice.ai");
    expect(displayName(POSTER, "")).toBe("0x1111…1111");
    expect(displayName(ZERO_ADDRESS)).toBe("");
    expect(shortAddress("0xabc")).toBe("0xabc");
  });
  it("formats durations", () => {
    expect(formatDuration(3 * 86400 + 4 * 3600 + 5)).toBe("3d 4h");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(0)).toBe("0s");
  });
  it("formats relative time", () => {
    expect(relativeTime(NOW + 2 * 86400, NOW)).toBe("in 2 days");
    expect(relativeTime(NOW - 3 * 3600, NOW)).toBe("3 hours ago");
  });
  it("round-trips datetime-local values", () => {
    const t = 1_800_000_000 - (1_800_000_000 % 60);
    expect(fromDateTimeLocal(toDateTimeLocal(t))).toBe(t);
    expect(fromDateTimeLocal("")).toBeNull();
  });
});

describe("parseHandle", () => {
  it("strips .ai and @", () => {
    expect(parseHandle(" alice.ai ")).toEqual({ ok: true, handle: "alice" });
    expect(parseHandle("@bob.AI")).toEqual({ ok: true, handle: "bob" });
    expect(parseHandle("carol")).toEqual({ ok: true, handle: "carol" });
    expect(parseHandle("Dave.AI")).toEqual({ ok: true, handle: "dave" });
  });
  it("rejects bad input", () => {
    expect(parseHandle("").ok).toBe(false);
    expect(parseHandle(".ai").ok).toBe(false);
    expect(parseHandle("a b").ok).toBe(false);
    expect(parseHandle("ab").ok).toBe(false);
    expect(parseHandle("a".repeat(21)).ok).toBe(false);
    expect(parseHandle("a.b.ai").ok).toBe(false);
    expect(parseHandle(POSTER).ok).toBe(false);
  });
});

describe("availableActions", () => {
  it("lets an agent claim an open job", () => {
    expect(availableActions(job(), viewer(OTHER), NOW)).toEqual({ role: "agent", actions: ["claim"], claimBlocker: null });
  });
  it("explains why a claim is blocked", () => {
    expect(availableActions(job(), viewer(null), NOW).claimBlocker).toBe("connect");
    expect(availableActions(job(), viewer(OTHER, false), NOW).claimBlocker).toBe("no-agent-id");
    expect(availableActions(job(), viewer(OTHER, true, true), NOW).claimBlocker).toBe("barred");
    expect(availableActions(job({ assignee: WORKER }), viewer(OTHER), NOW).claimBlocker).toBe("not-assignee");
    expect(availableActions(job({ assignee: WORKER }), viewer(WORKER), NOW).actions).toEqual(["claim"]);
  });
  it("lets the poster cancel but not claim", () => {
    const a = availableActions(job(), viewer(POSTER), NOW);
    expect(a.role).toBe("poster");
    expect(a.actions).toEqual(["cancel"]);
    expect(a.claimBlocker).toBe("is-poster");
  });
  it("offers refund to anyone after the deadline, and no claim", () => {
    const late = NOW + 86401;
    expect(availableActions(job(), viewer(OTHER), late)).toEqual({ role: "agent", actions: ["refund"], claimBlocker: "expired" });
    expect(availableActions(job(), viewer(POSTER), late).actions).toEqual(["cancel", "refund"]);
    expect(availableActions(job(), viewer(null), late).actions).toEqual([]);
  });
  it("lets the worker submit or unclaim a claimed job", () => {
    const j = job({ status: Status.Claimed, worker: WORKER });
    expect(availableActions(j, viewer(WORKER), NOW).actions).toEqual(["submit", "unclaim"]);
    expect(availableActions(j, viewer(POSTER), NOW).actions).toEqual([]);
    expect(availableActions(j, viewer(OTHER), NOW).actions).toEqual([]);
    expect(availableActions(j, viewer(WORKER), NOW + 86401).actions).toEqual(["unclaim", "refund"]);
  });
  it("handles the review window", () => {
    const j = job({ status: Status.Submitted, worker: WORKER, submittedAt: NOW, result: "done" });
    expect(availableActions(j, viewer(POSTER), NOW + 10).actions).toEqual(["accept", "reject"]);
    expect(availableActions(j, viewer(OTHER), NOW + 10).actions).toEqual([]);
    expect(availableActions(j, viewer(WORKER), NOW + 10).actions).toEqual([]);
    const after = NOW + REVIEW_PERIOD + 1;
    expect(availableActions(j, viewer(POSTER), after).actions).toEqual(["accept", "release"]);
    expect(availableActions(j, viewer(OTHER), after).actions).toEqual(["release"]);
    expect(availableActions(j, viewer(null), after).actions).toEqual([]);
  });
  it("offers nothing on finished jobs", () => {
    for (const status of [Status.Paid, Status.Cancelled, Status.Refunded]) {
      expect(availableActions(job({ status }), viewer(POSTER), NOW + 999999).actions).toEqual([]);
    }
  });
  it("assigns roles", () => {
    expect(roleOf(job({ assignee: WORKER }), viewer(WORKER))).toBe("assignee");
    expect(roleOf(job({ worker: WORKER, status: Status.Claimed }), viewer(WORKER))).toBe("worker");
    expect(roleOf(job(), viewer(OTHER, false))).toBe("visitor");
  });
});

describe("board", () => {
  const jobs = [
    job({ id: 0n }),
    job({ id: 1n, status: Status.Claimed, worker: WORKER }),
    job({ id: 2n, status: Status.Paid, worker: OTHER, poster: WORKER }),
    job({ id: 3n, status: Status.Refunded }),
  ];
  it("filters by status and mine", () => {
    expect(filterJobs(jobs, "open", null).map((j) => j.id)).toEqual([0n]);
    expect(filterJobs(jobs, "in-progress", null).map((j) => j.id)).toEqual([1n]);
    expect(filterJobs(jobs, "closed", null).map((j) => j.id)).toEqual([3n]);
    expect(filterJobs(jobs, "all", WORKER).map((j) => j.id)).toEqual([1n, 2n]);
  });
  it("pages newest first", () => {
    expect(nextPage(45, 0, 20)).toEqual({ from: 25, count: 20 });
    expect(nextPage(45, 40, 20)).toEqual({ from: 0, count: 5 });
    expect(nextPage(45, 45, 20)).toBeNull();
    expect(nextPage(0, 0, 20)).toBeNull();
  });
});

describe("leaderboard", () => {
  it("ranks Agent ID holders by completed, then earned", () => {
    const jobs = [
      job({ status: Status.Paid, worker: WORKER, workerHandle: "w", posterHandle: "p", reward: 10n * E18 }),
      job({ status: Status.Paid, worker: OTHER, workerHandle: "o", posterHandle: "p", reward: 50n * E18 }),
      job({ status: Status.Open }),
    ];
    const stats = new Map<string, AgentStats>([
      [WORKER.toLowerCase(), { posted: 0, paidOut: 0, rejectionsGiven: 0, completed: 1, rejected: 0 }],
      [OTHER.toLowerCase(), { posted: 0, paidOut: 0, rejectionsGiven: 0, completed: 1, rejected: 1 }],
      [POSTER.toLowerCase(), { posted: 3, paidOut: 2, rejectionsGiven: 0, completed: 0, rejected: 0 }],
    ]);
    const rows = buildLeaderboard(jobs, stats);
    expect(rows.map((r) => r.handle)).toEqual(["o", "w", "p"]);
    expect(rows[0].earned).toBe(50n * E18);
    expect(rows[2].paidOut).toBe(2);
  });
});
