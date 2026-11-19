import { BaseError, ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { sqrJobsDecodeAbi } from "../src/abis.ts";
import { CheckError, ERROR_MESSAGES, explainError, revertName } from "../src/errors.ts";
import { sqrJobsAbi } from "../../abi/sqrJobsAbi.ts";

function reverted(data: `0x${string}`) {
  const cause = new ContractFunctionRevertedError({ abi: sqrJobsDecodeAbi, data, functionName: "claim" });
  return new ContractFunctionExecutionError(cause, { abi: sqrJobsDecodeAbi, functionName: "claim", args: [1n] });
}

describe("error mapping", () => {
  it("has a plain message for every custom error in the contract ABI", () => {
    const names = sqrJobsAbi.filter((x) => x.type === "error").map((x) => x.name);
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) expect(ERROR_MESSAGES[n], n).toBeTruthy();
  });
  it("decodes custom errors from a simulated revert", () => {
    for (const name of ["NotAgent", "ReviewOpen", "WrongStatus", "Barred"] as const) {
      const err = reverted(encodeErrorResult({ abi: sqrJobsAbi, errorName: name }));
      expect(revertName(err)).toBe(name);
      const e = explainError(err);
      expect(e).toBeInstanceOf(CheckError);
      expect(e.code).toBe(name);
      expect(e.message).toBe(ERROR_MESSAGES[name]);
    }
    expect(explainError(reverted(encodeErrorResult({ abi: sqrJobsAbi, errorName: "NotAgent" }))).message).toMatch(/no Agent ID/);
  });
  it("decodes token errors that bubble up through SqrJobs", () => {
    const data = encodeErrorResult({
      abi: sqrJobsDecodeAbi,
      errorName: "ERC20InsufficientAllowance",
      args: [getAddress("0x00000000000000000000000000000000000000c0"), 0n, 5n],
    });
    expect(explainError(reverted(data)).code).toBe("ERC20InsufficientAllowance");
  });
  it("maps BEP20 string reverts", () => {
    const data = encodeErrorResult({ abi: [{ type: "error", name: "Error", inputs: [{ type: "string", name: "message" }] }], errorName: "Error", args: ["BEP20: transfer amount exceeds allowance"] });
    expect(revertName(reverted(data))).toBe("ERC20InsufficientAllowance");
  });
  it("falls back to the viem short message", () => {
    expect(explainError(new BaseError("fetch failed")).message).toMatch(/fetch failed/);
    expect(explainError(new Error("boom")).message).toMatch(/boom/);
  });
});
