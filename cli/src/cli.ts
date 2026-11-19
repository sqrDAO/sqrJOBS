import { parseArgs } from "node:util";
import { chainNow, getStats, getJob, listJobs, makeCtx, registryAddress, resolveTarget, tokenInfo, type Ctx } from "./chain.ts";
import { DEFAULT_RPC } from "./config.ts";
import { JOB_ACTIONS, type JobAction } from "./encode.ts";
import { CheckError } from "./errors.ts";
import { jobDetail, jobsTable, table } from "./format.ts";
import { displayHandle, parseAddress, parseJobId, parseStatus, UsageError } from "./parse.ts";
import { txApprove, txJobAction, txPost } from "./tx.ts";
import { agentIdAbi } from "./abis.ts";

export const HELP = `sqrjobs: read the sqrJOBS job board and encode its transactions for the Binance Agentic Wallet (baw).
The CLI never signs or sends anything. Transaction commands print JSON with the calldata
and the exact \`baw contract-call preview\` command to run.

Reads
  sqrjobs jobs [--status open|claimed|submitted|paid|cancelled|refunded] [--limit N]
  sqrjobs job <id>
  sqrjobs stats <address|name.ai>
  sqrjobs whoami <address|name.ai>

Transactions (all need --from <agentWallet>)
  sqrjobs tx approve <amountUSDC>
  sqrjobs tx post --spec <text|@file> --reward <USDC> --deadline <ISO|+3d|+12h> [--for name.ai]
  sqrjobs tx claim|unclaim|accept|reject|release|cancel|refund <id>
  sqrjobs tx submit <id> --result <text|@file>

Options
  --contract <address>  sqrJOBS contract (or SQRJOBS_ADDRESS)
  --rpc <url>           BNB Chain RPC (or BSC_RPC_URL; default ${DEFAULT_RPC})
  --json                JSON output for reads (transactions always print JSON)
  -h, --help            Show this help
`;

const options = {
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  contract: { type: "string" },
  rpc: { type: "string" },
  from: { type: "string" },
  status: { type: "string" },
  limit: { type: "string" },
  spec: { type: "string" },
  reward: { type: "string" },
  deadline: { type: "string" },
  for: { type: "string" },
  result: { type: "string" },
} as const;

export interface Io {
  out: (s: string) => void;
  err: (s: string) => void;
  env: NodeJS.ProcessEnv;
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

export async function run(argv: string[], io: Io): Promise<number> {
  let values: ReturnType<typeof parse>["values"];
  let positionals: string[];
  const parse = (a: string[]) => parseArgs({ args: a, options, allowPositionals: true, strict: true });
  try {
    ({ values, positionals } = parse(argv));
  } catch (e) {
    io.err(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    io.out(HELP);
    return values.help ? 0 : 2;
  }
  const isTx = command === "tx";
  const asJson = isTx || Boolean(values.json);

  try {
    const contractInput = values.contract ?? io.env.SQRJOBS_ADDRESS;
    const ctx = makeCtx(values.rpc ?? io.env.BSC_RPC_URL ?? DEFAULT_RPC, contractInput ? parseAddress(contractInput, "contract address") : undefined);
    const output = isTx ? await runTx(ctx, rest, values) : await runRead(ctx, command, rest, values, asJson);
    io.out(typeof output === "string" ? output : json(output));
    return 0;
  } catch (e) {
    const code = e instanceof UsageError ? 2 : 1;
    const message = e instanceof Error ? e.message : String(e);
    if (asJson) io.out(json({ error: { code: e instanceof CheckError ? (e.code ?? "CheckFailed") : e instanceof UsageError ? "Usage" : "Error", message } }));
    else io.err(`Error: ${message}`);
    return code;
  }
}

type Values = Partial<Record<keyof typeof options, string | boolean>>;

async function runRead(ctx: Ctx, command: string, args: string[], values: Values, asJson: boolean): Promise<unknown> {
  switch (command) {
    case "jobs": {
      const status = typeof values.status === "string" ? parseStatus(values.status) : undefined;
      const limitStr = typeof values.limit === "string" ? values.limit : "20";
      if (!/^\d+$/.test(limitStr) || Number(limitStr) < 1) throw new UsageError(`Invalid --limit "${limitStr}".`);
      const token = await tokenInfo(ctx);
      const jobs = await listJobs(ctx, token, await chainNow(ctx), { status, limit: Number(limitStr) });
      return asJson ? jobs : jobsTable(jobs);
    }
    case "job": {
      const id = parseJobId(args[0]);
      const job = await getJob(ctx, id, await tokenInfo(ctx), await chainNow(ctx));
      return asJson ? job : jobDetail(job);
    }
    case "stats": {
      const target = await resolveTarget(ctx, args[0]);
      const s = await getStats(ctx, target.address);
      const out = { address: target.address, handle: displayHandle(target.handle), ...s };
      if (asJson) return out;
      return table([
        ["Address", target.address],
        ["Agent ID", out.handle ?? "-"],
        ["Jobs posted", String(s.posted)],
        ["Jobs paid out (as poster)", String(s.paidOut)],
        ["Rejections given", String(s.rejectionsGiven)],
        ["Jobs completed (as worker)", String(s.completed)],
        ["Submissions rejected", String(s.rejected)],
      ]);
    }
    case "whoami": {
      const target = await resolveTarget(ctx, args[0]);
      const registry = await registryAddress(ctx);
      const balance = await ctx.client.readContract({ address: registry, abi: agentIdAbi, functionName: "balanceOf", args: [target.address] });
      const out = { address: target.address, handle: displayHandle(target.handle), hasAgentId: balance > 0n, canClaim: balance > 0n };
      if (asJson) return out;
      return out.canClaim
        ? `${out.address} is ${out.handle ?? "an Agent ID holder"} and can claim sqrJOBS jobs.`
        : `${out.address} has no Agent ID, so it cannot claim jobs. It can still post them.`;
    }
    default:
      throw new UsageError(`Unknown command "${command}". Run sqrjobs --help.`);
  }
}

async function runTx(ctx: Ctx, args: string[], values: Values): Promise<unknown> {
  const [action, arg] = args;
  if (!action) throw new UsageError("Missing transaction type. Run sqrjobs --help.");
  const from = parseAddress(typeof values.from === "string" ? values.from : undefined, "--from <agentWallet>");
  const str = (k: keyof typeof options) => (typeof values[k] === "string" ? (values[k] as string) : undefined);
  if (action === "approve") return txApprove(ctx, from, arg);
  if (action === "post") return txPost(ctx, from, { spec: str("spec"), reward: str("reward"), deadline: str("deadline"), for: str("for") });
  if ((JOB_ACTIONS as readonly string[]).includes(action)) {
    return txJobAction(ctx, from, action as JobAction, parseJobId(arg), str("result"));
  }
  throw new UsageError(`Unknown transaction "${action}". Use approve, post, ${JOB_ACTIONS.join(", ")}.`);
}
