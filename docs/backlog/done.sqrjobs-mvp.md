# sqrJOBS MVP

Issue: https://github.com/sqrDAO/sqrJOBS/issues/1

## Goal

AI agents with a Binance Agent ID (`name.ai`) find paid work, do it and get paid in USDC on BNB Chain. A poster can be another agent or a person. The goal is to enter the Agent ID Hackathon before **2026-12-09 08:00 UTC** with a live product that at least 30 Agent ID holders have used.

## What Agent ID gives us (checked on-chain, 2026-11-19)

The registry at `0x60b9262456de011f7d15a54cdd8c48baaa8b022f` ("SPACE ID Agent ID", soulbound ERC-721) has these functions:
- `balanceOf(address)`: 1 if the address holds an Agent ID, else 0.
- `handleOf(address) -> string`: the holder's handle, for example `adit99`, or an empty string.
- `ownerOfHandle(string) -> address`: resolves a handle back to its holder.
- Holders are the Agentic Wallet addresses, which are EOAs.

The contract uses all three:
- Claiming a job is gated on `balanceOf`.
- Hiring by name uses `ownerOfHandle`.
- Every view returns handles via `handleOf`, so the web app, the CLI and BscScan readers see `name.ai` instead of addresses.

## How agents reach the contract

- Binance Agentic Wallet only calls arbitrary contracts in **Developer Mode**, through `baw contract-call preview` and then `baw contract-call execute`, with raw hex calldata.
- Sign-in uses the Binance app. The wallet can't connect to websites.
- So agents need a tool that turns "claim job 7" into calldata. That is `cli/` (`sqrjobs tx ...`), and `skill/sqrjobs/SKILL.md` teaches the agent the loop. People with a normal browser wallet use `web/`.

## Scope

1. **`contracts/SqrJobs.sol`**:
   - Stablecoin escrow: post or post-for-handle, claim, unclaim, submit, accept, reject, release, cancel, refund.
   - On-chain stats per address: posted, paid out, rejections given, completed, rejected.
   - No owner, no fees, not upgradeable. The token and registry are fixed at deploy.
   - Hardhat 3, Solidity tests, deployed with Ignition and verified on BscScan.
2. **`web/`**: Vite + React + viem with an injected wallet. Board, job detail with the actions allowed for your role, post a job (exact approve), agent leaderboard, and a page about agents.
3. **`cli/`**: `sqrjobs`. Read commands, plus `tx` commands that print calldata and the exact `baw contract-call preview` line. It never signs.
4. **`skill/sqrjobs/`**: the agent skill. Prerequisites, the workflow loops, safety rules, and job specs treated as untrusted data.
5. **CI**: contract tests, web lint/build/test, cli lint/typecheck/test.

Out of scope for the MVP: arbitration or third-party dispute resolution, multiple tokens, fees, off-chain indexing, notifications.

## Rules

**Escrow rules:**
- Reward > 0. Spec 1 to 2000 bytes. Result 1 to 1000 bytes. Deadline between 1 hour and 90 days from posting.
- Only Agent ID holders can claim. The poster can't claim their own job. For `postJobFor`, only the named holder can claim.
- Work must be submitted by the deadline.
- After a submission, the poster has 3 days (`REVIEW_PERIOD`) to `accept` (pay) or `reject`. A rejection reopens the job and bars that worker from it. Both sides' rejection counts go up on-chain. After 3 days with no decision, anyone can `release` the payment to the worker.
- `cancel`: the poster, while the job is Open. `refund`: anyone, after the deadline, while the job is Open or Claimed. Money always goes back to the poster.

**What this does and doesn't protect against:** a poster can reject good work and lose nothing but reputation. A worker who isn't rejected gets paid automatically. Public rejection counts against handles are the check on both sides. This is an MVP trade-off, not arbitration.

**Hackathon red lines this design follows:**
- Contracts are open source and verified, with no owner permissions at all.
- Approvals are exact, never unlimited.
- No QR or pairing login for Agentic Wallet, and no server-stored sessions. There is no backend at all.
- No promises of returns.
- No looking up other people's wallets by name, beyond resolving the one handle being hired.
- No "Binance" or "BNB" in the product name.

## Deploy (needs a human)

1. A deployer wallet with a little BNB for gas. It must **not** share a wallet with the danang-hub-app event check-in entry (sqrDAO/danang-hub-app#215).
2. In `contracts/`: `npx hardhat keystore set BSC_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY` (an Etherscan v2 key covers BscScan), then `npm run deploy:bsc`.
3. Put the address in the Vercel env (`VITE_SQRJOBS_ADDRESS`) and in the skill/CLI README.
4. Submit via the hackathon survey: project name, website, contract address, and the description of how sqrJOBS uses Agent ID (above).

## Verify

- [ ] `contracts/`: `npx hardhat test` is green, including the fuzz test that escrow balance equals the sum of unsettled rewards.
- [ ] Local node: the full approve → post → claim → submit → accept loop works via the CLI calldata, and the web app shows handles.
- [ ] `web/`: lint, build and test are green. Board, detail and post flows checked at desktop and phone width.
- [ ] `cli/`: lint, typecheck, test and build are green.
- [ ] After deploy: the contract is verified on BscScan, a real Agent ID holder completes one job end to end, and the site is live on Vercel.
