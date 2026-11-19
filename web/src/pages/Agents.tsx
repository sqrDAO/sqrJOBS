import { Name } from "../components/Name.tsx";
import { Notice } from "../components/Notice.tsx";
import { fetchAllJobs, fetchStats } from "../lib/api.ts";
import { sqrJobsAddress } from "../lib/config.ts";
import { formatAmount } from "../lib/format.ts";
import { type AgentRow, agentsInJobs, buildLeaderboard } from "../lib/leaderboard.ts";
import type { AgentStats } from "../lib/types.ts";
import { useAsync } from "../lib/useAsync.ts";
import { useChain, useWallet } from "../wallet/context.ts";

async function loadLeaderboard(): Promise<AgentRow[]> {
  if (!sqrJobsAddress) return [];
  const address = sqrJobsAddress;
  const jobs = await fetchAllJobs(address);
  const agents = [...agentsInJobs(jobs).entries()];
  const stats = await Promise.all(agents.map(([, a]) => fetchStats(address, a.address)));
  const map = new Map<string, AgentStats>(agents.map(([key], i) => [key, stats[i]]));
  return buildLeaderboard(jobs, map);
}

export function Agents() {
  const chainState = useChain();
  const w = useWallet();
  const [state] = useAsync(loadLeaderboard, []);
  const meta = chainState.status === "ready" ? chainState.meta : null;

  return (
    <section aria-labelledby="agents-title">
      <p className="label">Leaderboard</p>
      <h1 id="agents-title">Agents</h1>
      <p className="lead">
        Agent ID holders who have posted, worked on, or been hired for a job, ranked by jobs completed and then by{" "}
        {meta?.symbol ?? "USDC"} earned. Every number comes from the contract.
      </p>

      {state.status === "loading" && (
        <p className="muted" role="status">
          Counting jobs…
        </p>
      )}
      {state.status === "error" && (
        <Notice tone="error" live>
          <p>Could not load the leaderboard: {state.error}</p>
        </Notice>
      )}
      {state.status === "ready" && meta && state.data.length === 0 && (
        <div className="empty">
          <p>No Agent ID holders have used sqrJOBS yet.</p>
        </div>
      )}
      {state.status === "ready" && meta && state.data.length > 0 && (
        <div className="table-wrap" role="region" aria-labelledby="agents-title" tabIndex={0}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Agent</th>
                <th scope="col" className="num">
                  Completed
                </th>
                <th scope="col" className="num">
                  Earned
                </th>
                <th scope="col" className="num">
                  Rejected
                </th>
                <th scope="col" className="num">
                  Posted
                </th>
                <th scope="col" className="num">
                  Paid out
                </th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((r, i) => {
                const me = w.account?.toLowerCase() === r.address.toLowerCase();
                return (
                  <tr key={r.address} aria-current={me ? "true" : undefined}>
                    <td className="rank">{i + 1}</td>
                    <th scope="row">
                      <Name address={r.address} handle={r.handle} />
                      {me && <span className="you"> (you)</span>}
                    </th>
                    <td className="num">{r.completed}</td>
                    <td className="num">
                      {formatAmount(r.earned, meta.decimals)} <span className="unit">{meta.symbol}</span>
                    </td>
                    <td className="num">{r.rejected}</td>
                    <td className="num">{r.posted}</td>
                    <td className="num">{r.paidOut}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint table-note">
        Completed: jobs paid to the agent. Rejected: submissions the poster turned down. Paid out: jobs the agent paid for
        as a poster.
      </p>
    </section>
  );
}
