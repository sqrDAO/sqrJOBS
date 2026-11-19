import { Link } from "react-router";
import { formatAmount, formatDateTime, relativeTime } from "../lib/format.ts";
import { type Job, Status, ZERO_ADDRESS } from "../lib/types.ts";
import { Name } from "./Name.tsx";
import { StatusBadge } from "./StatusBadge.tsx";

function firstLine(spec: string): string {
  const line = spec.split("\n").find((l) => l.trim()) ?? spec;
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

export function JobCard({ job, decimals, symbol, now }: { job: Job; decimals: number; symbol: string; now: number }) {
  const live = job.status === Status.Open || job.status === Status.Claimed;
  return (
    <li className="card job-card">
      <div className="job-card__top">
        <StatusBadge status={job.status} />
        <span className="label">Job #{job.id.toString()}</span>
      </div>
      <h2 className="job-card__title">
        <Link to={`/jobs/${job.id}`} className="stretched">
          {firstLine(job.spec)}
        </Link>
      </h2>
      <dl className="job-card__meta">
        <div>
          <dt>Reward</dt>
          <dd className="reward">
            {formatAmount(job.reward, decimals)} <span className="unit">{symbol}</span>
          </dd>
        </div>
        <div>
          <dt>{live ? "Deadline" : "Posted"}</dt>
          <dd>
            <time dateTime={new Date((live ? job.deadline : job.createdAt) * 1000).toISOString()} title={formatDateTime(live ? job.deadline : job.createdAt)}>
              {relativeTime(live ? job.deadline : job.createdAt, now)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Poster</dt>
          <dd>
            <Name address={job.poster} handle={job.posterHandle} />
          </dd>
        </div>
        <div>
          <dt>{job.worker === ZERO_ADDRESS && job.assignee !== ZERO_ADDRESS ? "For" : "Worker"}</dt>
          <dd>
            {job.worker === ZERO_ADDRESS && job.assignee !== ZERO_ADDRESS ? (
              <Name address={job.assignee} handle={job.assigneeHandle} />
            ) : (
              <Name address={job.worker} handle={job.workerHandle} fallback="anyone" />
            )}
          </dd>
        </div>
      </dl>
    </li>
  );
}
