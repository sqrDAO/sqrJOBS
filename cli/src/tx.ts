import { zeroAddress, type Address } from "viem";
import { erc20DecodeAbi, sqrJobsDecodeAbi } from "./abis.ts";
import { chainNow, getJob, ownerOfHandle, registryAddress, requireContract, tokenInfo, type Ctx } from "./chain.ts";
import { MAX_RESULT_BYTES, MAX_SPEC_BYTES } from "./config.ts";
import { encodeApprove, encodeJobAction, encodePost, txOutput, type JobAction, type TxOutput } from "./encode.ts";
import { CheckError, ERROR_MESSAGES, explainError } from "./errors.ts";
import { byteLength, checkDeadlineWindow, normalizeHandle, parseAmount, parseDeadline, readTextArg, UsageError } from "./parse.ts";
import { formatUnits } from "viem";

async function simulate(fn: () => Promise<unknown>, onError?: (e: CheckError) => CheckError): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const e = explainError(err);
    throw onError ? onError(e) : e;
  }
}

/** ERC-20 approve of exactly `amount` to the SqrJobs contract. */
export async function txApprove(ctx: Ctx, from: Address, amountInput: string | undefined): Promise<TxOutput> {
  if (!amountInput) throw new UsageError("Missing amount. Usage: sqrjobs tx approve <amountUSDC> --from <address>");
  const spender = requireContract(ctx);
  const token = await tokenInfo(ctx);
  const amount = parseAmount(amountInput, token.decimals);
  await simulate(() =>
    ctx.client.simulateContract({ address: token.address, abi: erc20DecodeAbi, functionName: "approve", args: [spender, amount], account: from }),
  );
  const data = encodeApprove(spender, amount);
  return txOutput(
    from,
    token.address,
    data,
    `Approve the sqrJOBS contract ${spender} to spend exactly ${formatUnits(amount, token.decimals)} ${token.symbol} from ${from}. ` +
      `This replaces any earlier allowance. It is needed before posting a job with this reward.`,
  );
}

export interface PostArgs {
  spec?: string;
  reward?: string;
  deadline?: string;
  for?: string;
}

export async function txPost(ctx: Ctx, from: Address, args: PostArgs): Promise<TxOutput> {
  const contract = requireContract(ctx);
  const spec = readTextArg(args.spec, "spec");
  if (byteLength(spec) > MAX_SPEC_BYTES) throw new CheckError(ERROR_MESSAGES.SpecTooLong!, "SpecTooLong");
  if (!args.reward) throw new UsageError("Missing --reward <USDC>.");
  if (!args.deadline) throw new UsageError("Missing --deadline <ISO|+3d|+12h>.");
  const now = await chainNow(ctx);
  const deadline = parseDeadline(args.deadline, now);
  checkDeadlineWindow(deadline, now);
  const handle = args.for ? normalizeHandle(args.for) : undefined;

  const token = await tokenInfo(ctx);
  const reward = parseAmount(args.reward, token.decimals);
  const human = `${formatUnits(reward, token.decimals)} ${token.symbol}`;

  let assignee: Address | undefined;
  if (handle) {
    assignee = await ownerOfHandle(ctx, await registryAddress(ctx), handle);
    if (assignee === zeroAddress) throw new CheckError(`No Agent ID is registered for ${handle}.ai.`, "UnknownHandle");
    if (assignee.toLowerCase() === from.toLowerCase()) throw new CheckError("You cannot reserve a job for your own Agent ID: the poster cannot claim it.", "PosterCannotClaim");
  }

  const [allowance, balance] = await Promise.all([
    ctx.client.readContract({ address: token.address, abi: erc20DecodeAbi, functionName: "allowance", args: [from, contract] }),
    ctx.client.readContract({ address: token.address, abi: erc20DecodeAbi, functionName: "balanceOf", args: [from] }),
  ]);
  if (allowance < reward) {
    throw new CheckError(
      `The ${token.symbol} allowance (${formatUnits(allowance, token.decimals)}) is lower than the reward (${human}). ` +
        `Run \`sqrjobs tx approve ${formatUnits(reward, token.decimals)} --from ${from}\` first.`,
      "ERC20InsufficientAllowance",
    );
  }
  if (balance < reward) {
    throw new CheckError(`The wallet holds ${formatUnits(balance, token.decimals)} ${token.symbol}, less than the reward (${human}).`, "ERC20InsufficientBalance");
  }

  await simulate(() =>
    handle
      ? ctx.client.simulateContract({ address: contract, abi: sqrJobsDecodeAbi, functionName: "postJobFor", args: [spec, reward, deadline, handle], account: from })
      : ctx.client.simulateContract({ address: contract, abi: sqrJobsDecodeAbi, functionName: "postJob", args: [spec, reward, deadline], account: from }),
  );

  const who = handle ? `reserved for ${handle}.ai (${assignee})` : "open to any Agent ID holder";
  return txOutput(
    from,
    contract,
    encodePost(spec, reward, deadline, handle),
    `Post a sqrJOBS job paying ${human}, ${who}, deadline ${new Date(Number(deadline) * 1000).toISOString()}. ` +
      `The reward moves from ${from} into escrow until the job is paid, cancelled or refunded.`,
  );
}

export async function txJobAction(ctx: Ctx, from: Address, action: JobAction, id: bigint, resultInput?: string): Promise<TxOutput> {
  const contract = requireContract(ctx);
  const token = await tokenInfo(ctx);
  const job = await getJob(ctx, id, token, await chainNow(ctx));

  let result: string | undefined;
  if (action === "submit") {
    result = readTextArg(resultInput, "result");
    if (byteLength(result) > MAX_RESULT_BYTES) throw new CheckError(ERROR_MESSAGES.ResultTooLong!, "ResultTooLong");
  }

  await simulate(
    () =>
      action === "submit"
        ? ctx.client.simulateContract({ address: contract, abi: sqrJobsDecodeAbi, functionName: "submit", args: [id, result!], account: from })
        : ctx.client.simulateContract({ address: contract, abi: sqrJobsDecodeAbi, functionName: action, args: [id], account: from }),
    (e) => (e.code === "WrongStatus" ? new CheckError(`${e.message} Job #${id} is ${job.status}.`, e.code) : e),
  );

  const reward = `${job.reward} ${job.token}`;
  const poster = job.posterHandle ?? job.poster;
  const worker = job.workerHandle ?? job.worker ?? "the worker";
  const descriptions: Record<JobAction, string> = {
    claim: `Claim sqrJOBS job #${id} (reward ${reward}, deadline ${job.deadline}, posted by ${poster}). Submit the result before the deadline to get paid.`,
    unclaim: `Give sqrJOBS job #${id} back so another agent can claim it.`,
    submit: `Submit the result for sqrJOBS job #${id} (${byteLength(result ?? "")} bytes). The poster then has 3 days to accept or reject; after that anyone can release the ${reward} payment.`,
    accept: `Accept the submission on sqrJOBS job #${id} and pay ${reward} to ${worker}.`,
    reject: `Reject the submission by ${worker} on sqrJOBS job #${id}. The job reopens, ${worker} cannot claim it again, and the rejection is recorded on-chain for both sides.`,
    release: `Release ${reward} to ${worker} for sqrJOBS job #${id}; the review period has ended.`,
    cancel: `Cancel open sqrJOBS job #${id} and return ${reward} to the poster ${poster}.`,
    refund: `Refund ${reward} to the poster ${poster} for sqrJOBS job #${id}; the deadline passed without a submission.`,
  };
  return txOutput(from, contract, encodeJobAction(action, id, result), descriptions[action]);
}
