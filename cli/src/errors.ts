import { BaseError, ContractFunctionRevertedError } from "viem";

/** Plain-language explanations of the contract's custom errors (and token errors that bubble up). */
export const ERROR_MESSAGES: Record<string, string> = {
  NoReward: "The reward must be greater than zero.",
  BadDeadline: "The deadline must be between 1 hour and 90 days from now.",
  SpecTooLong: "The job spec is longer than 2000 bytes. Put long specs behind a URL.",
  ResultTooLong: "The result is longer than 1000 bytes. Put long results behind a URL.",
  EmptyResult: "The result is empty.",
  EmptySpec: "The job spec is empty.",
  UnknownHandle: "No Agent ID is registered for that handle.",
  UnknownJob: "There is no job with that id.",
  WrongStatus: "The job is not in a status that allows this action.",
  NotPoster: "Only the agent that posted this job can do this.",
  NotWorker: "Only the agent that claimed this job can do this.",
  NotAgent: "This wallet has no Agent ID, so it cannot claim jobs. Get a name.ai Agent ID in the Binance App first.",
  NotAssignee: "This job is reserved for a different Agent ID.",
  PosterCannotClaim: "The poster cannot claim their own job.",
  Barred: "Your earlier submission on this job was rejected, so you cannot claim it again.",
  PastDeadline: "The job's deadline has passed.",
  NotExpired: "The deadline has not passed yet, so the job cannot be refunded. The poster can cancel it while it is still Open.",
  ReviewOpen: "The 3-day review period is still running, so payment cannot be released yet. The poster can accept now.",
  ReviewClosed: "The 3-day review period has ended, so the submission can no longer be rejected. Anyone can now release the payment.",
  ERC20InsufficientAllowance: "The USDC allowance is lower than the reward. Run `sqrjobs tx approve <reward>` first (exact amount).",
  ERC20InsufficientBalance: "The wallet does not hold enough USDC.",
  SafeERC20FailedOperation: "The token transfer failed.",
  ReentrancyGuardReentrantCall: "Reentrant call blocked.",
};

/** A pre-check failed: the transaction would revert or is not allowed. Exit code 1. */
export class CheckError extends Error {
  override name = "CheckError";
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Find the custom error name (or revert reason) in a viem error. */
export function revertName(err: unknown): string | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (!(reverted instanceof ContractFunctionRevertedError)) return undefined;
  const name = reverted.data?.errorName;
  if (name && name !== "Error" && name !== "Panic") return name;
  const reason = reverted.reason ?? "";
  // Binance-Peg USDC is a BEP20 token that reverts with strings, not custom errors.
  if (/allowance/i.test(reason)) return "ERC20InsufficientAllowance";
  if (/exceeds balance/i.test(reason)) return "ERC20InsufficientBalance";
  return reason || undefined;
}

/** Turn any simulation failure into a CheckError with a plain message. */
export function explainError(err: unknown): CheckError {
  if (err instanceof CheckError) return err;
  const name = revertName(err);
  if (name && ERROR_MESSAGES[name]) return new CheckError(ERROR_MESSAGES[name]!, name);
  if (name) return new CheckError(`The transaction would revert: ${name}`, name);
  if (err instanceof BaseError) return new CheckError(`The check failed: ${err.shortMessage}`);
  return new CheckError(`The check failed: ${err instanceof Error ? err.message : String(err)}`);
}
