// Copies the compiled SqrJobs ABI to ../abi for the web app and the CLI.
import { readFileSync, writeFileSync } from "node:fs";

const { abi } = JSON.parse(readFileSync("artifacts/contracts/SqrJobs.sol/SqrJobs.json", "utf8"));
writeFileSync("../abi/SqrJobs.json", JSON.stringify(abi, null, 2) + "\n");
writeFileSync(
  "../abi/sqrJobsAbi.ts",
  "// Generated from contracts/artifacts by `npm run abi` in contracts/. Do not edit.\nexport const sqrJobsAbi = " +
    JSON.stringify(abi, null, 2) +
    " as const;\n",
);
console.log(`Wrote ${abi.length} ABI entries to ../abi`);
