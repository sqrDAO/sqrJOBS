import { STATUS_LABEL, type Status } from "../lib/types.ts";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="badge" data-status={status}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
