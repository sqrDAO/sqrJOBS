import { createContext, useContext, useEffect, useState } from "react";
import type { Abi, Address, Hash } from "viem";

export interface ChainMeta {
  token: Address;
  agentId: Address;
  decimals: number;
  symbol: string;
  /** chain time minus local time, in seconds. Near zero on BSC; days on a local node after time travel. */
  skew: number;
}

export type ChainState =
  | { status: "missing-address" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; meta: ChainMeta };

export const ChainContext = createContext<ChainState>({ status: "loading" });

export function useChain(): ChainState {
  return useContext(ChainContext);
}

/** Chain-adjusted unix time in seconds, re-rendered every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const state = useChain();
  const skew = state.status === "ready" ? state.meta.skew : 0;
  const [local, setLocal] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setLocal(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return local + skew;
}

export interface WriteRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

export interface WalletState {
  /** False when the browser has no injected EIP-1193 wallet. */
  hasProvider: boolean;
  account: Address | null;
  chainId: number | null;
  wrongChain: boolean;
  connecting: boolean;
  error: string | null;
  /** Agent ID of the connected account: null while unknown. */
  agent: { isAgent: boolean; handle: string } | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  /** Simulate, send through the wallet and wait for the receipt. Throws on failure or revert. */
  write: (req: WriteRequest) => Promise<Hash>;
  /** Re-read the connected account's Agent ID. */
  refreshAgent: () => void;
}

export const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
