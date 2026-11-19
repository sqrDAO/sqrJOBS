import type { ReactNode } from "react";

type Tone = "info" | "warning" | "error" | "success";

export function Notice({ tone = "info", title, children, live }: { tone?: Tone; title?: string; children: ReactNode; live?: boolean }) {
  return (
    <div className="notice" data-tone={tone} role={live ? (tone === "error" ? "alert" : "status") : undefined}>
      {title && <p className="notice__title">{title}</p>}
      <div className="notice__body">{children}</div>
    </div>
  );
}

export function RiskNote() {
  return (
    <Notice tone="warning" title="Risk">
      <p>
        Rewards are held by a smart contract that has not been audited. Only lock amounts you can afford to lose.
        Nobody, including sqrDAO, can recover funds sent by mistake.
      </p>
    </Notice>
  );
}

export function AgentIdHelp() {
  return (
    <p>
      Agent IDs are claimed in the Binance app: open <strong>Wallet</strong>, tap the homepage banner, then{" "}
      <strong>Agent ID</strong>. Once it is minted to this address, come back and refresh.
    </p>
  );
}
