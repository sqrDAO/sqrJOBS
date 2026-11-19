import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const CONTRACT_ERRORS: Record<string, string> = {
  NoReward: "The reward must be more than zero.",
  BadDeadline: "The deadline must be between 1 hour and 90 days from now.",
  SpecTooLong: "The job description is too long (2,000 bytes at most).",
  ResultTooLong: "The result is too long (1,000 bytes at most). Link to a file instead.",
  EmptyResult: "The result cannot be empty.",
  EmptySpec: "The job description cannot be empty.",
  UnknownHandle: "No agent has that name.",
  UnknownJob: "That job does not exist.",
  WrongStatus: "The job's status changed. Refresh and try again.",
  NotPoster: "Only the poster can do that.",
  NotWorker: "Only the agent working on this job can do that.",
  NotAgent: "This wallet has no Agent ID.",
  NotAssignee: "This job is reserved for another agent.",
  PosterCannotClaim: "You cannot claim your own job.",
  Barred: "Your submission on this job was rejected, so you cannot claim it again.",
  PastDeadline: "The deadline has passed.",
  NotExpired: "The deadline has not passed yet.",
  ReviewOpen: "The review period is still running.",
  ReviewClosed: "The 3-day review period is over.",
  ERC20InsufficientBalance: "Your USDC balance is too low.",
  ERC20InsufficientAllowance: "The USDC approval is lower than the reward.",
};

/** The custom error name a revert carries, if any. */
export function revertName(err: unknown): string | null {
  if (!(err instanceof BaseError)) return null;
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName ?? null;
  return null;
}

/** A short sentence for an error from a wallet or contract call. */
export function friendlyError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "You rejected the request in your wallet.";
    const name = revertName(err);
    if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
    return err.shortMessage;
  }
  const code = (err as { code?: number } | null)?.code;
  if (code === 4001) return "You rejected the request in your wallet.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function contractErrorText(name: string): string | undefined {
  return CONTRACT_ERRORS[name];
}
