import { type Address, type Hash, parseEventLogs } from "viem";
import { sqrJobsAbi } from "./abis.ts";
import { publicClient } from "./client.ts";
import { type AgentStats, type Job, type RawJobView, toJob } from "./types.ts";

export async function fetchJobCount(address: Address): Promise<number> {
  return Number(await publicClient.readContract({ address, abi: sqrJobsAbi, functionName: "jobCount" }));
}

export async function fetchJobs(address: Address, from: number, count: number): Promise<Job[]> {
  const raw = await publicClient.readContract({
    address,
    abi: sqrJobsAbi,
    functionName: "getJobs",
    args: [BigInt(from), BigInt(count)],
  });
  return (raw as readonly RawJobView[]).map(toJob);
}

/** Every job, oldest first, in windows of `pageSize`. */
export async function fetchAllJobs(address: Address, pageSize = 100): Promise<Job[]> {
  const total = await fetchJobCount(address);
  const windows: Promise<Job[]>[] = [];
  for (let from = 0; from < total; from += pageSize) windows.push(fetchJobs(address, from, pageSize));
  return (await Promise.all(windows)).flat();
}

export async function fetchJob(address: Address, id: bigint): Promise<Job> {
  const raw = await publicClient.readContract({ address, abi: sqrJobsAbi, functionName: "getJob", args: [id] });
  return toJob(raw as RawJobView);
}

export async function fetchBarred(address: Address, id: bigint, who: Address): Promise<boolean> {
  return publicClient.readContract({ address, abi: sqrJobsAbi, functionName: "barred", args: [id, who] });
}

export async function fetchStats(address: Address, who: Address): Promise<AgentStats> {
  const [posted, paidOut, rejectionsGiven, completed, rejected] = await publicClient.readContract({
    address,
    abi: sqrJobsAbi,
    functionName: "stats",
    args: [who],
  });
  return { posted, paidOut, rejectionsGiven, completed, rejected };
}

/** The job id a `postJob` / `postJobFor` transaction created. */
export async function postedJobId(hash: Hash): Promise<bigint | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash });
  const [log] = parseEventLogs({ abi: sqrJobsAbi, eventName: "JobPosted", logs: receipt.logs });
  return log ? log.args.id : null;
}
