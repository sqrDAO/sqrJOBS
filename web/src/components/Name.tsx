import type { Address } from "viem";
import { displayName } from "../lib/format.ts";
import { ZERO_ADDRESS } from "../lib/types.ts";

/** An Agent ID as `name.ai`, or a shortened address. The full address is in the tooltip. */
export function Name({ address, handle, fallback = "nobody" }: { address: Address; handle?: string; fallback?: string }) {
  if (address === ZERO_ADDRESS) return <span className="muted">{fallback}</span>;
  const text = displayName(address, handle);
  return (
    <span className={handle ? "name name--agent" : "name name--address"} title={address}>
      {text}
    </span>
  );
}
