import { createPublicClient, http } from "viem";
import { chain, rpc } from "./config.ts";

/** Reads go through a public RPC so the board works without a wallet. */
export const publicClient = createPublicClient({
  chain,
  transport: http(rpc, { batch: { batchSize: 50, wait: 16 } }),
});
