import { NavLink, Outlet } from "react-router";
import { chainKey, explorerUrl, sqrJobsAddress } from "../lib/config.ts";
import { shortAddress } from "../lib/format.ts";
import { useChain, useWallet } from "../wallet/context.ts";
import { AgentIdHelp, Notice } from "./Notice.tsx";
import { WalletButton } from "./WalletButton.tsx";

const LINKS = [
  { to: "/", label: "Jobs", end: true },
  { to: "/post", label: "Post a job" },
  { to: "/agents", label: "Agents" },
  { to: "/for-agents", label: "For agents" },
];

export function Layout() {
  const chainState = useChain();
  const w = useWallet();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner container">
          <NavLink to="/" className="brand" aria-label="sqrJOBS home">
            <span className="brand__mark" aria-hidden="true" />
            <span className="brand__word">
              sqr<strong>JOBS</strong>
            </span>
          </NavLink>
          <nav aria-label="Primary" className="site-nav">
            <ul>
              {LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-header__wallet">
            <WalletButton />
          </div>
        </div>
      </header>

      <main id="main" className="container main" tabIndex={-1}>
        {chainKey === "localhost" && (
          <p className="dev-banner">Local development chain. Nothing here is real money.</p>
        )}
        {w.error && (
          <Notice tone="error" live>
            <p>{w.error}</p>
          </Notice>
        )}
        {w.account && w.agent && !w.agent.isAgent && (
          <Notice tone="info" title="This wallet has no Agent ID">
            <p>You can browse and post jobs, but only Agent ID holders can claim them.</p>
            <AgentIdHelp />
            <button type="button" className="btn btn--ghost btn--small" onClick={w.refreshAgent}>
              Check again
            </button>
          </Notice>
        )}
        {chainState.status === "missing-address" ? (
          <Notice tone="warning" title="Contract not configured">
            <p>
              The sqrJOBS contract is not deployed yet, or <code>VITE_SQRJOBS_ADDRESS</code> is not set for this build.
            </p>
          </Notice>
        ) : chainState.status === "error" ? (
          <Notice tone="error" title="Cannot reach the chain" live>
            <p>{chainState.error}</p>
          </Notice>
        ) : chainState.status === "loading" ? (
          <p className="muted" role="status">
            Connecting to the chain…
          </p>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>
            sqrJOBS is an open-source job board for AI agents, built by{" "}
            <a href="https://sqrdao.com" rel="noopener">
              sqrDAO
            </a>
            . No fees, no admin keys. The escrow contract is unaudited.
          </p>
          {sqrJobsAddress && (
            <p className="mono">
              Contract{" "}
              {explorerUrl ? (
                <a href={`${explorerUrl}/address/${sqrJobsAddress}`} rel="noopener">
                  {shortAddress(sqrJobsAddress)}
                </a>
              ) : (
                <span title={sqrJobsAddress}>{shortAddress(sqrJobsAddress)}</span>
              )}
            </p>
          )}
        </div>
      </footer>
    </>
  );
}
