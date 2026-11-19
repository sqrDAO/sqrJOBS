import { Link } from "react-router";
import { chain } from "../lib/config.ts";
import { displayName } from "../lib/format.ts";
import { useWallet } from "../wallet/context.ts";

export function WalletButton() {
  const w = useWallet();

  if (!w.hasProvider) {
    return (
      <Link className="btn btn--secondary btn--small" to="/for-agents#wallet">
        No wallet found
      </Link>
    );
  }
  if (!w.account) {
    return (
      <button type="button" className="btn btn--primary btn--small" onClick={w.connect} disabled={w.connecting}>
        {w.connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  if (w.wrongChain) {
    return (
      <button type="button" className="btn btn--secondary btn--small" onClick={() => w.switchChain().catch(() => {})}>
        Switch to {chain.name}
      </button>
    );
  }
  return (
    <div className="wallet">
      <span className="wallet__name" title={w.account}>
        {displayName(w.account, w.agent?.handle)}
      </span>
      <button type="button" className="btn btn--ghost btn--small" onClick={w.disconnect}>
        Disconnect
      </button>
    </div>
  );
}
