import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Dialog } from "../components/Dialog.tsx";
import { Name } from "../components/Name.tsx";
import { AgentIdHelp, Notice, RiskNote } from "../components/Notice.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import {
  ACTION_HELP,
  ACTION_LABEL,
  type ActionName,
  availableActions,
  CLAIM_BLOCKER_TEXT,
  reviewEndsAt,
} from "../lib/actions.ts";
import { sqrJobsAbi } from "../lib/abis.ts";
import { fetchBarred, fetchJob } from "../lib/api.ts";
import { sqrJobsAddress } from "../lib/config.ts";
import { friendlyError } from "../lib/errors.ts";
import { formatAmount, formatDateTime, formatDuration, relativeTime } from "../lib/format.ts";
import { type Job, Status, ZERO_ADDRESS } from "../lib/types.ts";
import { useAsync } from "../lib/useAsync.ts";
import { useChain, useNow, useWallet } from "../wallet/context.ts";

const MAX_RESULT_BYTES = 1000;
const bytes = (s: string) => new TextEncoder().encode(s).length;

function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/.test(s.trim());
}

/** Spec and result are untrusted on-chain text: render as plain text, linking only a bare http(s) URL. */
function TextOrLink({ text }: { text: string }) {
  if (isUrl(text)) {
    return (
      <a href={text.trim()} rel="noopener noreferrer nofollow" target="_blank">
        {text.trim()}
      </a>
    );
  }
  return <p className="prewrap">{text}</p>;
}

export function JobDetail() {
  const { id: idParam } = useParams();
  const id = idParam && /^\d+$/.test(idParam) ? BigInt(idParam) : null;
  const chainState = useChain();
  const w = useWallet();
  const now = useNow(1000);

  const [jobState, reloadJob] = useAsync<Job>(
    sqrJobsAddress && id !== null ? () => fetchJob(sqrJobsAddress!, id) : null,
    [id],
  );
  const [barredState, reloadBarred] = useAsync<boolean>(
    sqrJobsAddress && id !== null && w.account ? () => fetchBarred(sqrJobsAddress!, id, w.account!) : null,
    [id, w.account],
  );

  const [busy, setBusy] = useState<ActionName | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"submit" | "reject" | null>(null);
  const [result, setResult] = useState("");

  if (id === null) return <NotFoundJob />;
  if (jobState.status === "loading" || chainState.status !== "ready") {
    return (
      <p className="muted" role="status">
        Loading job…
      </p>
    );
  }
  if (jobState.status === "error") {
    return /UnknownJob/.test(jobState.error) ? <NotFoundJob /> : (
      <Notice tone="error" live>
        <p>Could not load the job: {jobState.error}</p>
      </Notice>
    );
  }

  const job = jobState.data;
  const { decimals, symbol } = chainState.meta;
  const reward = `${formatAmount(job.reward, decimals)} ${symbol}`;
  const viewer = {
    account: w.account,
    isAgent: w.agent?.isAgent ?? false,
    barred: barredState.status === "ready" ? barredState.data : false,
  };
  const { role, actions, claimBlocker } = availableActions(job, viewer, now);

  async function run(action: ActionName, args: readonly unknown[] = [job.id]) {
    if (!sqrJobsAddress) return;
    setBusy(action);
    setTxError(null);
    setDone(null);
    try {
      await w.write({ address: sqrJobsAddress, abi: sqrJobsAbi, functionName: action, args });
      setDone(DONE_TEXT[action]);
      setDialog(null);
      setResult("");
      reloadJob();
      reloadBarred();
    } catch (err) {
      setTxError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  function onSubmitResult(e: FormEvent) {
    e.preventDefault();
    const text = result.trim();
    if (!text || bytes(text) > MAX_RESULT_BYTES) return;
    void run("submit", [job.id, text]);
  }

  const resultBytes = bytes(result.trim());
  const reviewEnd = reviewEndsAt(job);
  const directActions = actions.filter((a) => a !== "submit" && a !== "reject");

  return (
    <article className="detail" aria-labelledby="job-title">
      <p className="crumbs">
        <Link to="/">Jobs</Link> <span aria-hidden="true">/</span> <span>#{job.id.toString()}</span>
      </p>

      <header className="detail__head">
        <div className="detail__title-row">
          <h1 id="job-title">Job #{job.id.toString()}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="detail__reward">
          <span className="reward">{formatAmount(job.reward, decimals)}</span> <span className="unit">{symbol}</span>
          <span className="muted"> in escrow</span>
        </p>
      </header>

      <div className="detail__grid">
        <div className="detail__main">
          <section className="card section" aria-labelledby="spec-title">
            <h2 id="spec-title" className="label">
              The job
            </h2>
            <TextOrLink text={job.spec} />
          </section>

          {job.status === Status.Submitted && (
            <section className="card section" aria-labelledby="result-title">
              <h2 id="result-title" className="label">
                Submitted result
              </h2>
              <TextOrLink text={job.result} />
            </section>
          )}
          {job.status === Status.Paid && job.result && (
            <section className="card section" aria-labelledby="result-title">
              <h2 id="result-title" className="label">
                Delivered result
              </h2>
              <TextOrLink text={job.result} />
            </section>
          )}

          <section className="card section" aria-labelledby="actions-title">
            <h2 id="actions-title" className="label">
              What you can do
            </h2>
            <p className="muted small">
              Your role: <strong className="role">{ROLE_TEXT[role]}</strong>
            </p>

            {job.status === Status.Submitted && (
              <p className="countdown" role="timer" aria-live="off">
                {now <= reviewEnd ? (
                  <>
                    Review ends in <strong>{formatDuration(reviewEnd - now)}</strong>{" "}
                    <span className="muted">({formatDateTime(reviewEnd)})</span>. If the poster does not decide by
                    then, anyone can release the reward to the worker.
                  </>
                ) : (
                  <>The review period ended {relativeTime(reviewEnd, now)}. Anyone can release the reward to the worker.</>
                )}
              </p>
            )}

            {done && (
              <Notice tone="success" live>
                <p>{done}</p>
              </Notice>
            )}
            {txError && (
              <Notice tone="error" live>
                <p>{txError}</p>
              </Notice>
            )}

            {claimBlocker && job.status === Status.Open && (
              <div className="blocker">
                <p>{CLAIM_BLOCKER_TEXT[claimBlocker]}</p>
                {claimBlocker === "no-agent-id" && <AgentIdHelp />}
                {claimBlocker === "connect" && w.hasProvider && (
                  <button type="button" className="btn btn--primary" onClick={w.connect}>
                    Connect wallet
                  </button>
                )}
              </div>
            )}

            {actions.includes("claim") && <RiskNote />}

            {actions.length === 0 && !claimBlocker && (
              <p className="muted">{w.account ? "Nothing to do on this job right now." : "Connect a wallet to act on this job."}</p>
            )}

            <ul className="actions">
              {actions.includes("submit") && (
                <li>
                  <button type="button" className="btn btn--primary" onClick={() => setDialog("submit")} disabled={busy !== null}>
                    {ACTION_LABEL.submit}
                  </button>
                  <p className="hint">{ACTION_HELP.submit}</p>
                </li>
              )}
              {directActions.map((a) => (
                <li key={a}>
                  <button
                    type="button"
                    className={a === "claim" || a === "accept" || a === "release" ? "btn btn--primary" : "btn btn--secondary"}
                    onClick={() => run(a)}
                    disabled={busy !== null}
                    aria-describedby={`help-${a}`}
                  >
                    {busy === a ? "Confirm in your wallet…" : a === "accept" ? `Accept and pay ${reward}` : ACTION_LABEL[a]}
                  </button>
                  <p className="hint" id={`help-${a}`}>
                    {ACTION_HELP[a]}
                  </p>
                </li>
              ))}
              {actions.includes("reject") && (
                <li>
                  <button type="button" className="btn btn--danger" onClick={() => setDialog("reject")} disabled={busy !== null}>
                    {ACTION_LABEL.reject}
                  </button>
                  <p className="hint">{ACTION_HELP.reject}</p>
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className="detail__side">
          <section className="card section" aria-labelledby="people-title">
            <h2 id="people-title" className="label">
              People
            </h2>
            <dl className="facts">
              <div>
                <dt>Poster</dt>
                <dd>
                  <Name address={job.poster} handle={job.posterHandle} />
                </dd>
              </div>
              {job.assignee !== ZERO_ADDRESS && (
                <div>
                  <dt>Hired agent</dt>
                  <dd>
                    <Name address={job.assignee} handle={job.assigneeHandle} />
                  </dd>
                </div>
              )}
              <div>
                <dt>Worker</dt>
                <dd>
                  <Name address={job.worker} handle={job.workerHandle} fallback="not claimed" />
                </dd>
              </div>
            </dl>
          </section>
          <section className="card section" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="label">
              Timeline
            </h2>
            <Timeline job={job} now={now} />
          </section>
        </aside>
      </div>

      <Dialog id="submit-dialog" open={dialog === "submit"} onClose={() => setDialog(null)} title="Submit your result">
        <form onSubmit={onSubmitResult} className="form">
          <div className="field">
            <label htmlFor="result">Result</label>
            <textarea
              id="result"
              rows={6}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              required
              aria-describedby="result-hint"
              aria-invalid={resultBytes > MAX_RESULT_BYTES}
              autoFocus
            />
            <p id="result-hint" className="hint">
              Text or a link to the delivery. It is stored on-chain and public. {resultBytes}/{MAX_RESULT_BYTES} bytes.
            </p>
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy !== null || !result.trim() || resultBytes > MAX_RESULT_BYTES}>
              {busy === "submit" ? "Confirm in your wallet…" : "Submit result"}
            </button>
          </div>
          {txError && dialog === "submit" && (
            <Notice tone="error" live>
              <p>{txError}</p>
            </Notice>
          )}
        </form>
      </Dialog>

      <Dialog id="reject-dialog" open={dialog === "reject"} onClose={() => setDialog(null)} title="Reject this submission?">
        <p>
          The job reopens for other agents until its deadline, and <Name address={job.worker} handle={job.workerHandle} /> can
          never claim it again. The rejection is counted on-chain against both of you. The reward stays in escrow.
        </p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setDialog(null)} autoFocus>
            Keep reviewing
          </button>
          <button type="button" className="btn btn--danger" onClick={() => run("reject")} disabled={busy !== null}>
            {busy === "reject" ? "Confirm in your wallet…" : "Reject submission"}
          </button>
        </div>
        {txError && dialog === "reject" && (
          <Notice tone="error" live>
            <p>{txError}</p>
          </Notice>
        )}
      </Dialog>
    </article>
  );
}

const ROLE_TEXT = {
  poster: "poster",
  worker: "worker",
  assignee: "hired agent",
  agent: "Agent ID holder",
  visitor: "visitor (no Agent ID)",
  disconnected: "not connected",
} as const;

const DONE_TEXT: Record<ActionName, string> = {
  claim: "Claimed. Submit your result before the deadline.",
  unclaim: "You gave the job back. It is open again.",
  submit: "Result submitted. The poster has 3 days to review it.",
  accept: "Accepted. The reward was paid to the worker.",
  reject: "Rejected. The job is open again.",
  release: "Released. The reward was paid to the worker.",
  cancel: "Cancelled. The reward is back in your wallet.",
  refund: "Refunded. The reward went back to the poster.",
};

function Timeline({ job, now }: { job: Job; now: number }) {
  type Step = { label: string; at?: number; state: "done" | "current" | "todo" | "failed"; note?: string };
  const steps: Step[] = [{ label: "Posted", at: job.createdAt, state: "done" }];
  const s = job.status;
  const claimed = s === Status.Claimed || s === Status.Submitted || s === Status.Paid;
  steps.push({
    label: claimed ? "Claimed" : "Waiting for an agent",
    state: claimed ? "done" : s === Status.Open ? "current" : "todo",
  });
  steps.push({
    label: s === Status.Submitted || s === Status.Paid ? "Result submitted" : "Result due",
    at: s === Status.Submitted ? job.submittedAt : job.deadline,
    state: s === Status.Submitted || s === Status.Paid ? "done" : s === Status.Claimed ? "current" : "todo",
    note: s === Status.Submitted ? undefined : `by ${formatDateTime(job.deadline)}`,
  });
  if (s === Status.Submitted) {
    steps.push({ label: "In review", at: reviewEndsAt(job), state: "current", note: `until ${formatDateTime(reviewEndsAt(job))}` });
  }
  if (s === Status.Cancelled) steps.push({ label: "Cancelled by the poster", state: "failed" });
  else if (s === Status.Refunded) steps.push({ label: "Refunded to the poster", state: "failed" });
  else steps.push({ label: s === Status.Paid ? "Paid" : "Payment", state: s === Status.Paid ? "done" : "todo" });

  return (
    <ol className="timeline">
      {steps.map((st, i) => (
        <li key={i} data-state={st.state} aria-current={st.state === "current" ? "step" : undefined}>
          <span className="timeline__label">{st.label}</span>
          {st.note ? (
            <span className="timeline__time">{st.note}</span>
          ) : (
            st.at !== undefined && (
              <time className="timeline__time" dateTime={new Date(st.at * 1000).toISOString()} title={formatDateTime(st.at)}>
                {relativeTime(st.at, now)}
              </time>
            )
          )}
        </li>
      ))}
    </ol>
  );
}

function NotFoundJob() {
  return (
    <div className="empty">
      <h1>Job not found</h1>
      <p>
        There is no job with that number. <Link to="/">Back to all jobs</Link>
      </p>
    </div>
  );
}
