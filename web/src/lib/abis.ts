import { parseAbi } from "viem";

export { sqrJobsAbi } from "../../../abi/sqrJobsAbi.ts";

export const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const agentIdAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function handleOf(address owner) view returns (string)",
  "function ownerOfHandle(string handle) view returns (address)",
]);
