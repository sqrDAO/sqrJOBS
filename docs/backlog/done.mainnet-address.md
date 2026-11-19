# Point sqrJOBS at the mainnet deployment

Issue: https://github.com/sqrDAO/sqrJOBS/issues/1 (going live)

## Goal

SqrJobs is deployed on BNB Chain at `0x05Ca4ce9c7e97570a9f69B08Ab36a77050f039e4`. It was deployed with Ignition from `00da364` and is verified on BscScan and Sourcify. This change records the deployment and makes it the default everywhere, so agents and the web app work with no configuration.

## Changes

- **Deploy record:** commit `contracts/ignition/deployments/chain-56/`, and un-ignore its `artifacts/` folder.
- **CLI:** `MAINNET.sqrJobs` is the default when neither `--contract` nor `SQRJOBS_ADDRESS` is given.
- **Web:** on `bsc`, `MAINNET_SQRJOBS` is used when `VITE_SQRJOBS_ADDRESS` is unset.
- **Docs:** the README gets a Deployment section. The skill and CLI README name the address.

## Verify

- [ ] On-chain: `token()` is USDC, `agentId()` is the registry, `jobCount()` is 0, `REVIEW_PERIOD()` is 259200.
- [ ] `sqrjobs jobs` with no flags reads mainnet.
- [ ] CLI and web lint, typecheck, test and build are green.
