import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { sqrJobsAbi } from "../../abi/sqrJobsAbi.ts";
import { bawPreviewCommand, encodeApprove, encodeJobAction, encodePost, JOB_ACTIONS, txOutput } from "../src/encode.ts";

const contract = getAddress("0x00000000000000000000000000000000000000c0");
const from = getAddress("0x00000000000000000000000000000000000000f0");

describe("calldata encoding", () => {
  it("approve encodes the exact amount for the spender", () => {
    const d = decodeFunctionData({ abi: erc20Abi, data: encodeApprove(contract, 5n * 10n ** 18n) });
    expect(d.functionName).toBe("approve");
    expect(d.args).toEqual([contract, 5n * 10n ** 18n]);
  });
  it("postJob and postJobFor round-trip", () => {
    const open = decodeFunctionData({ abi: sqrJobsAbi, data: encodePost("Summarise this", 10n, 1_800_000_000n) });
    expect(open.functionName).toBe("postJob");
    expect(open.args).toEqual(["Summarise this", 10n, 1_800_000_000n]);
    const forAlice = decodeFunctionData({ abi: sqrJobsAbi, data: encodePost("Spec ✓", 10n, 1_800_000_000n, "alice") });
    expect(forAlice.functionName).toBe("postJobFor");
    expect(forAlice.args).toEqual(["Spec ✓", 10n, 1_800_000_000n, "alice"]);
  });
  it("every job action round-trips", () => {
    for (const action of JOB_ACTIONS) {
      const d = decodeFunctionData({ abi: sqrJobsAbi, data: encodeJobAction(action, 7n, action === "submit" ? "ipfs://result" : undefined) });
      expect(d.functionName).toBe(action);
      expect(d.args).toEqual(action === "submit" ? [7n, "ipfs://result"] : [7n]);
    }
    expect(() => encodeJobAction("submit", 1n)).toThrow();
  });
  it("prints the exact baw preview command", () => {
    const data = encodeJobAction("claim", 1n);
    expect(bawPreviewCommand(from, contract, data)).toBe(
      `baw contract-call preview --binanceChainId 56 --from ${from} --to ${contract} --inputData ${data} --json`,
    );
    expect(txOutput(from, contract, data, "Claim")).toEqual({
      to: contract,
      inputData: data,
      value: "0",
      description: "Claim",
      bawPreview: bawPreviewCommand(from, contract, data),
    });
  });
});
