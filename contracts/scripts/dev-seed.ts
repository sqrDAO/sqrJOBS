// Local development only. Deploys MockUSDC, MockAgentID and SqrJobs to a running Hardhat node,
// registers Agent ID handles for the default accounts, mints USDC and posts jobs in every state.
//
//   npx hardhat node
//   npx hardhat run scripts/dev-seed.ts --network localhost
//
// It moves the node's clock forward 3 days so some jobs have an expired deadline or review period.
import { network } from "hardhat";
import { parseUnits } from "viem";

const { viem, networkHelpers } = await network.create();
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();

const HOUR = 3600n;
const DAY = 24n * HOUR;
const usdc = (n: number) => parseUnits(String(n), 18);

// Accounts 0-3 and 5 get Agent IDs; account 4 is a poster without one.
const [sqrdao, alice, bob, carol, nobody, dave] = wallets;
const handles: [typeof sqrdao, string][] = [
  [sqrdao, "sqrdao"],
  [alice, "alice"],
  [bob, "bob"],
  [carol, "carol"],
  [dave, "dave"],
];

const token = await viem.deployContract("MockUSDC");
const agentId = await viem.deployContract("MockAgentID");
const jobs = await viem.deployContract("SqrJobs", [token.address, agentId.address]);

async function wait(hash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tx ${hash} reverted`);
}

for (const [w, handle] of handles) {
  await wait(await agentId.write.register([w.account.address, handle]));
}
for (const w of wallets.slice(0, 6)) {
  await wait(await token.write.mint([w.account.address, usdc(10_000)]));
}

let nextId = 0n;
type Wallet = typeof sqrdao;

async function post(poster: Wallet, spec: string, reward: number, inSeconds: bigint, forHandle?: string) {
  const amount = usdc(reward);
  const deadline = BigInt(await networkHelpers.time.latest()) + inSeconds;
  await wait(await token.write.approve([jobs.address, amount], { account: poster.account }));
  await wait(
    forHandle
      ? await jobs.write.postJobFor([spec, amount, deadline, forHandle], { account: poster.account })
      : await jobs.write.postJob([spec, amount, deadline], { account: poster.account }),
  );
  return nextId++;
}
const claim = async (w: Wallet, id: bigint) => wait(await jobs.write.claim([id], { account: w.account }));
const submit = async (w: Wallet, id: bigint, result: string) =>
  wait(await jobs.write.submit([id, result], { account: w.account }));
const accept = async (w: Wallet, id: bigint) => wait(await jobs.write.accept([id], { account: w.account }));
const reject = async (w: Wallet, id: bigint) => wait(await jobs.write.reject([id], { account: w.account }));

// Phase 1: jobs that need time to pass.
const refundMe = await post(
  nobody,
  "Summarise this week's governance forum threads into five bullet points with links.",
  15,
  2n * HOUR,
);
const releaseMe = await post(
  sqrdao,
  "Translate the Da Nang Blockchain Hub house rules (link below) from English to Vietnamese.\nhttps://danangblockchainhub.com/rules",
  20,
  30n * DAY,
);
await claim(alice, releaseMe);
await submit(alice, releaseMe, "https://gist.github.com/alice/house-rules-vi");
const expiredClaim = await post(sqrdao, "Write alt text for the 12 photos in the November meetup album.", 8, 2n * HOUR);
await claim(bob, expiredClaim);

await networkHelpers.time.increase(3n * DAY + 3n * HOUR);
await wait(await jobs.write.refund([refundMe], { account: carol.account }));

// Phase 2: jobs at today's chain time.
const paid1 = await post(carol, "Transcribe the 20-minute panel recording and mark each speaker.", 25, 7n * DAY);
await claim(alice, paid1);
await submit(alice, paid1, "https://example.com/panel-transcript.md");
await accept(carol, paid1);

const paid2 = await post(
  sqrdao,
  "Compile a list of 30 Vietnamese Web3 builder communities with their Telegram links.",
  40,
  10n * DAY,
);
await claim(bob, paid2);
await submit(bob, paid2, "https://example.com/vn-communities.csv");
await accept(sqrdao, paid2);

const paid3 = await post(alice, "Proofread this 800-word blog post and return tracked changes.", 12, 5n * DAY);
await claim(carol, paid3);
await submit(carol, paid3, "Done. Fixed 14 typos and two broken links: https://example.com/blog-proofread");
await accept(alice, paid3);

const cancelled = await post(nobody, "Design a logo for a tea shop.", 30, 5n * DAY);
await wait(await jobs.write.cancel([cancelled], { account: nobody.account }));

const inReview = await post(
  sqrdao,
  "Summarise the Agent ID hackathon rules in 10 bullets for our community channel.",
  10,
  6n * DAY,
);
await claim(carol, inReview);
await submit(
  carol,
  inReview,
  "1. Submissions close Dec 9.\n2. Contracts must be verified.\n3. Exact approvals only.\n...",
);

const claimed = await post(bob, "Benchmark three public BSC RPC endpoints for latency from Singapore.", 18, 4n * DAY);
await claim(alice, claimed);

await post(carol, "Draft a reply to the attached partnership email, friendly and short.", 6, 3n * DAY, "dave");

const reopened = await post(sqrdao, "Create a 5-question quiz about EIP-1193 for a workshop.", 9, 8n * DAY);
await claim(bob, reopened);
await submit(bob, reopened, "Q1: what is a provider?");
await reject(sqrdao, reopened);

await post(alice, "Find and fix the broken links on the sqrDAO events page.", 5, 2n * DAY);
await post(
  nobody,
  "Turn this meeting recording into minutes with action items and owners.",
  22,
  14n * DAY,
);
await post(sqrdao, "Write a short how-to: claiming an Agent ID in the wallet app, with screenshots.", 35, 21n * DAY);

const count = await jobs.read.jobCount();
console.log(`
Seeded ${count} jobs on chain ${await publicClient.getChainId()}.

  MockUSDC     ${token.address}
  MockAgentID  ${agentId.address}
  SqrJobs      ${jobs.address}

Agent IDs:
${handles.map(([w, h]) => `  ${h}.ai`.padEnd(14) + w.account.address).join("\n")}
  (no Agent ID) ${nobody.account.address}

web/.env.local:
  VITE_CHAIN=localhost
  VITE_SQRJOBS_ADDRESS=${jobs.address}
`);
