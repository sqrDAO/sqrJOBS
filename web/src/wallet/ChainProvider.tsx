import { useEffect, useState, type ReactNode } from "react";
import { erc20Abi, sqrJobsAbi } from "../lib/abis.ts";
import { publicClient } from "../lib/client.ts";
import { sqrJobsAddress } from "../lib/config.ts";
import { ChainContext, type ChainState } from "./context.ts";

export function ChainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChainState>(() =>
    sqrJobsAddress ? { status: "loading" } : { status: "missing-address" },
  );

  useEffect(() => {
    if (!sqrJobsAddress) return;
    const address = sqrJobsAddress;
    let cancelled = false;
    (async () => {
      try {
        const [token, agentId, block] = await Promise.all([
          publicClient.readContract({ address, abi: sqrJobsAbi, functionName: "token" }),
          publicClient.readContract({ address, abi: sqrJobsAbi, functionName: "agentId" }),
          publicClient.getBlock({ blockTag: "latest" }),
        ]);
        const [decimals, symbol] = await Promise.all([
          publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
          publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
        ]);
        const diff = Number(block.timestamp) - Math.floor(Date.now() / 1000);
        const skew = Math.abs(diff) > 60 ? diff : 0;
        if (!cancelled) setState({ status: "ready", meta: { token, agentId, decimals, symbol, skew } });
      } catch (err) {
        if (!cancelled) setState({ status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ChainContext.Provider value={state}>{children}</ChainContext.Provider>;
}
