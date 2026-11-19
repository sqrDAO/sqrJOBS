import { type Address, type Chain, isAddress } from "viem";
import { bsc, hardhat } from "viem/chains";

const env = import.meta.env;

export type ChainKey = "bsc" | "localhost";

export const chainKey: ChainKey = env.VITE_CHAIN === "localhost" ? "localhost" : "bsc";

const rpcUrl =
  chainKey === "localhost"
    ? env.VITE_LOCAL_RPC_URL || "http://127.0.0.1:8545"
    : env.VITE_BSC_RPC_URL || "https://bsc-rpc.publicnode.com";

const baseChain = chainKey === "localhost" ? hardhat : bsc;

/** The chain object handed to viem and to the wallet when adding or switching networks. */
export const chain: Chain = {
  ...baseChain,
  rpcUrls: { default: { http: [rpcUrl] } },
};

export const rpc = rpcUrl;

const rawAddress = (env.VITE_SQRJOBS_ADDRESS ?? "").trim();

/** Null until the contract is deployed and VITE_SQRJOBS_ADDRESS is set. */
export const sqrJobsAddress: Address | null = isAddress(rawAddress) ? rawAddress : null;

export const repoUrl = (env.VITE_REPO_URL || "https://github.com/sqrDAO/sqrJOBS").replace(/\/$/, "");

export const explorerUrl = chainKey === "bsc" ? "https://bscscan.com" : null;
