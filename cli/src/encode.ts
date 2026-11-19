import { encodeFunctionData, type Address, type Hex } from "viem";
import { erc20Abi, sqrJobsAbi } from "./abis.ts";
import { BINANCE_CHAIN_ID } from "./config.ts";

export type JobAction = "claim" | "unclaim" | "submit" | "accept" | "reject" | "release" | "cancel" | "refund";
export const JOB_ACTIONS: readonly JobAction[] = ["claim", "unclaim", "submit", "accept", "reject", "release", "cancel", "refund"];

export interface TxOutput {
  to: Address;
  inputData: Hex;
  value: "0";
  description: string;
  bawPreview: string;
}

export function encodeApprove(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

/** `handle` is without ".ai"; when given, encodes postJobFor. */
export function encodePost(spec: string, reward: bigint, deadline: bigint, handle?: string): Hex {
  if (handle) {
    return encodeFunctionData({ abi: sqrJobsAbi, functionName: "postJobFor", args: [spec, reward, deadline, handle] });
  }
  return encodeFunctionData({ abi: sqrJobsAbi, functionName: "postJob", args: [spec, reward, deadline] });
}

export function encodeJobAction(action: JobAction, id: bigint, result?: string): Hex {
  if (action === "submit") {
    if (result === undefined) throw new Error("submit needs a result");
    return encodeFunctionData({ abi: sqrJobsAbi, functionName: "submit", args: [id, result] });
  }
  return encodeFunctionData({ abi: sqrJobsAbi, functionName: action, args: [id] });
}

/** The exact `baw contract-call preview` command line. Every part is hex or an address, so no quoting is needed. */
export function bawPreviewCommand(from: Address, to: Address, inputData: Hex): string {
  return `baw contract-call preview --binanceChainId ${BINANCE_CHAIN_ID} --from ${from} --to ${to} --inputData ${inputData} --json`;
}

export function txOutput(from: Address, to: Address, inputData: Hex, description: string): TxOutput {
  return { to, inputData, value: "0", description, bawPreview: bawPreviewCommand(from, to, inputData) };
}
