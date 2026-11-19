import { createPublicClient, formatUnits, http, zeroAddress, type Address, type PublicClient } from "viem";
import { agentIdAbi, erc20Abi, sqrJobsAbi } from "./abis.ts";
import { MAINNET, REVIEW_PERIOD_SECONDS, type StatusName } from "./config.ts";
import { explainError } from "./errors.ts";
import { displayHandle, looksLikeHandle, normalizeHandle, parseAddress, statusName, UsageError } from "./parse.ts";

export interface Ctx {
  client: PublicClient;
  contract?: Address;
}

export interface TokenInfo {
  address: Address;
  decimals: number;
  symbol: string;
}

export function makeCtx(rpc: string, contract?: Address): Ctx {
  return { client: createPublicClient({ transport: http(rpc) }), contract };
}

/** Latest block timestamp. Deadlines are judged by chain time, not the local clock. */
export async function chainNow(ctx: Ctx): Promise<number> {
  const block = await ctx.client.getBlock({ blockTag: "latest" });
  return Number(block.timestamp);
}

export function requireContract(ctx: Ctx): Address {
  if (!ctx.contract) throw new UsageError("No sqrJOBS contract address. Pass --contract <address> or set SQRJOBS_ADDRESS.");
  return ctx.contract;
}

export async function tokenInfo(ctx: Ctx): Promise<TokenInfo> {
  const address = await ctx.client.readContract({ address: requireContract(ctx), abi: sqrJobsAbi, functionName: "token" });
  const [decimals, symbol] = await Promise.all([
    ctx.client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    ctx.client.readContract({ address, abi: erc20Abi, functionName: "symbol" }).catch(() => "USDC"),
  ]);
  return { address, decimals, symbol };
}

/** The Agent ID registry: the one SqrJobs was deployed with, or the mainnet one when no contract is set. */
export async function registryAddress(ctx: Ctx): Promise<Address> {
  if (!ctx.contract) return MAINNET.agentIdRegistry;
  return ctx.client.readContract({ address: ctx.contract, abi: sqrJobsAbi, functionName: "agentId" });
}

export async function handleOf(ctx: Ctx, registry: Address, who: Address): Promise<string> {
  if (who === zeroAddress) return "";
  try {
    return await ctx.client.readContract({ address: registry, abi: agentIdAbi, functionName: "handleOf", args: [who] });
  } catch {
    return "";
  }
}

export async function ownerOfHandle(ctx: Ctx, registry: Address, handle: string): Promise<Address> {
  return ctx.client.readContract({ address: registry, abi: agentIdAbi, functionName: "ownerOfHandle", args: [handle] });
}

/** Accept a 0x address or a name.ai handle. */
export async function resolveTarget(ctx: Ctx, input: string | undefined): Promise<{ address: Address; handle: string }> {
  if (!input) throw new UsageError("Missing address or name.ai.");
  const registry = await registryAddress(ctx);
  if (looksLikeHandle(input)) {
    const handle = normalizeHandle(input);
    const address = await ownerOfHandle(ctx, registry, handle);
    if (address === zeroAddress) throw new UsageError(`No Agent ID is registered for ${handle}.ai.`);
    return { address, handle };
  }
  const address = parseAddress(input, "address");
  return { address, handle: await handleOf(ctx, registry, address) };
}

type RawJobView = Awaited<ReturnType<typeof readJob>>;

function readJob(ctx: Ctx, id: bigint) {
  return ctx.client.readContract({ address: requireContract(ctx), abi: sqrJobsAbi, functionName: "getJob", args: [id] });
}

export interface JobJson {
  id: number;
  status: StatusName;
  reward: string;
  rewardRaw: string;
  token: string;
  poster: Address;
  posterHandle: string | null;
  assignee: Address | null;
  assigneeHandle: string | null;
  worker: Address | null;
  workerHandle: string | null;
  createdAt: string;
  deadline: string;
  expired: boolean;
  submittedAt: string | null;
  reviewEndsAt: string | null;
  spec: string;
  result: string;
}

const iso = (s: bigint) => new Date(Number(s) * 1000).toISOString();
const orNull = (a: Address) => (a === zeroAddress ? null : a);

export function toJobJson(v: RawJobView, token: TokenInfo, nowSeconds: number): JobJson {
  const j = v.job;
  return {
    id: Number(v.id),
    status: statusName(j.status),
    reward: formatUnits(j.reward, token.decimals),
    rewardRaw: j.reward.toString(),
    token: token.symbol,
    poster: j.poster,
    posterHandle: displayHandle(v.posterHandle),
    assignee: orNull(j.assignee),
    assigneeHandle: displayHandle(v.assigneeHandle),
    worker: orNull(j.worker),
    workerHandle: displayHandle(v.workerHandle),
    createdAt: iso(j.createdAt),
    deadline: iso(j.deadline),
    expired: BigInt(nowSeconds) > j.deadline,
    submittedAt: j.submittedAt ? iso(j.submittedAt) : null,
    reviewEndsAt: j.submittedAt ? iso(j.submittedAt + BigInt(REVIEW_PERIOD_SECONDS)) : null,
    spec: j.spec,
    result: j.result,
  };
}

export async function getJob(ctx: Ctx, id: bigint, token: TokenInfo, nowSeconds: number): Promise<JobJson> {
  try {
    return toJobJson(await readJob(ctx, id), token, nowSeconds);
  } catch (err) {
    throw explainError(err);
  }
}

/** Newest first, optionally filtered by status, up to `limit` jobs. */
export async function listJobs(ctx: Ctx, token: TokenInfo, nowSeconds: number, opts: { status?: number; limit: number }): Promise<JobJson[]> {
  const address = requireContract(ctx);
  const count = await ctx.client.readContract({ address, abi: sqrJobsAbi, functionName: "jobCount" });
  const page = 50n;
  const out: JobJson[] = [];
  let end = count;
  while (end > 0n && out.length < opts.limit) {
    const from = end > page ? end - page : 0n;
    const views = await ctx.client.readContract({ address, abi: sqrJobsAbi, functionName: "getJobs", args: [from, end - from] });
    for (const v of [...views].reverse()) {
      if (opts.status !== undefined && v.job.status !== opts.status) continue;
      out.push(toJobJson(v, token, nowSeconds));
      if (out.length >= opts.limit) break;
    }
    end = from;
  }
  return out;
}

export async function getStats(ctx: Ctx, who: Address) {
  const [posted, paidOut, rejectionsGiven, completed, rejected] = await ctx.client.readContract({
    address: requireContract(ctx),
    abi: sqrJobsAbi,
    functionName: "stats",
    args: [who],
  });
  return { posted, paidOut, rejectionsGiven, completed, rejected };
}
