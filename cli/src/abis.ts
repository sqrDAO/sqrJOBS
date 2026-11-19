import { erc20Abi, parseAbi } from "viem";
import { sqrJobsAbi } from "../../abi/sqrJobsAbi.ts";

export { sqrJobsAbi, erc20Abi };

/** The parts of the Agent ID registry the CLI reads. */
export const agentIdAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function handleOf(address owner) view returns (string)",
  "function ownerOfHandle(string handle) view returns (address)",
]);

/**
 * Errors that can bubble up through SqrJobs from the token (OpenZeppelin ERC-20 and
 * SafeERC20) or its ReentrancyGuard. They are not in the generated ABI, so we add them
 * for decoding reverts during simulation.
 */
export const bubbledErrorsAbi = parseAbi([
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error SafeERC20FailedOperation(address token)",
  "error ReentrancyGuardReentrantCall()",
]);

export const sqrJobsDecodeAbi = [...sqrJobsAbi, ...bubbledErrorsAbi] as const;
export const erc20DecodeAbi = [...erc20Abi, ...bubbledErrorsAbi] as const;
