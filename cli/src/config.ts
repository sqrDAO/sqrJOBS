import type { Address } from "viem";

export const DEFAULT_RPC = "https://bsc-rpc.publicnode.com";

/** Chain id passed to `baw contract-call preview --binanceChainId`. BNB Smart Chain mainnet. */
export const BINANCE_CHAIN_ID = 56;

/** BNB Chain mainnet addresses. --contract or SQRJOBS_ADDRESS overrides sqrJobs. */
export const MAINNET = {
  sqrJobs: "0x05Ca4ce9c7e97570a9f69B08Ab36a77050f039e4",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  agentIdRegistry: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
} as const satisfies Record<string, Address>;

// Mirrors the constants in contracts/contracts/SqrJobs.sol.
export const REVIEW_PERIOD_SECONDS = 3 * 24 * 60 * 60;
export const MIN_DURATION_SECONDS = 60 * 60;
export const MAX_DURATION_SECONDS = 90 * 24 * 60 * 60;
export const MAX_SPEC_BYTES = 2000;
export const MAX_RESULT_BYTES = 1000;

export const STATUS_NAMES = ["None", "Open", "Claimed", "Submitted", "Paid", "Cancelled", "Refunded"] as const;
export type StatusName = (typeof STATUS_NAMES)[number];
