import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// BNB Chain mainnet addresses. USDC is Binance-Peg USDC (18 decimals).
export const BSC_USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
export const BSC_AGENT_ID = "0x60b9262456de011f7d15a54cdd8c48baaa8b022f";

export default buildModule("SqrJobs", (m) => {
  const token = m.getParameter("token", BSC_USDC);
  const agentId = m.getParameter("agentId", BSC_AGENT_ID);
  const jobs = m.contract("SqrJobs", [token, agentId]);
  return { jobs };
});
