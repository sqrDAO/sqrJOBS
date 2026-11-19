import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import type { Address } from "viem";
import { Dialog } from "../components/Dialog.tsx";
import { Notice, RiskNote } from "../components/Notice.tsx";
import { agentIdAbi, erc20Abi, sqrJobsAbi } from "../lib/abis.ts";
import { postedJobId } from "../lib/api.ts";
import { publicClient } from "../lib/client.ts";
import { sqrJobsAddress } from "../lib/config.ts";
import { friendlyError } from "../lib/errors.ts";
import {
  formatAmount,
  formatDateTime,
  fromDateTimeLocal,
  parseAmount,
  shortAddress,
  toDateTimeLocal,
} from "../lib/format.ts";
import { parseHandle } from "../lib/handle.ts";
import { ZERO_ADDRESS } from "../lib/types.ts";
import { useChain, useNow, useWallet } from "../wallet/context.ts";

const MAX_SPEC_BYTES = 2000;
const HOUR = 3600;
const DAY = 86400;
const PRESETS = [
  { label: "1 day", seconds: DAY },
  { label: "3 days", seconds: 3 * DAY },
  { label: "1 week", seconds: 7 * DAY },
  { label: "2 weeks", seconds: 14 * DAY },
];
const bytes = (s: string) => new TextEncoder().encode(s).length;

type Resolve =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "found"; handle: string; address: Address }
  | { status: "missing"; handle: string }
  | { status: "invalid"; error: string };

type Step = "idle" | "approving" | "posting" | "done";

export function PostJob() {
  const chainState = useChain();
  const w = useWallet();
  const now = useNow(60_000);
  const navigate = useNavigate();
  const meta = chainState.status === "ready" ? chainState.meta : null;

  const [spec, setSpec] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState(() => toDateTimeLocal(now + 3 * DAY));
  const [hire, setHire] = useState("");
  const [lookup, setLookup] = useState<{ handle: string; address: Address } | null>(null);
  const [ack, setAck] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Resolve the one handle being hired, after the user pauses typing. Nothing else is ever looked up by name.
  const parsedHire = hire.trim() ? parseHandle(hire) : null;
  const hireHandle = parsedHire?.ok ? parsedHire.handle : null;
  useEffect(() => {
    if (!meta || !hireHandle) return;
    let cancelled = false;
    const t = setTimeout(() => {
      publicClient
        .readContract({ address: meta.agentId, abi: agentIdAbi, functionName: "ownerOfHandle", args: [hireHandle] })
        .then((address) => !cancelled && setLookup({ handle: hireHandle, address }))
        .catch(() => !cancelled && setLookup({ handle: hireHandle, address: ZERO_ADDRESS }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hireHandle, meta]);

  const resolve: Resolve =
    parsedHire === null
      ? { status: "idle" }
      : !parsedHire.ok
        ? { status: "invalid", error: parsedHire.error }
        : lookup?.handle !== parsedHire.handle
          ? { status: "checking" }
          : lookup.address === ZERO_ADDRESS
            ? { status: "missing", handle: lookup.handle }
            : { status: "found", handle: lookup.handle, address: lookup.address };

  useEffect(() => {
    if (!meta || !w.account) return;
    let cancelled = false;
    publicClient
      .readContract({ address: meta.token, abi: erc20Abi, functionName: "balanceOf", args: [w.account] })
      .then((b) => !cancelled && setBalance(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta, w.account, step]);

  if (!meta || !sqrJobsAddress) return null;
  const contract = sqrJobsAddress;

  const reward = parseAmount(amount, meta.decimals);
  const deadlineTs = fromDateTimeLocal(deadline);
  const specBytes = bytes(spec.trim());
  const minDeadline = now + HOUR + 5 * 60;
  const maxDeadline = now + 90 * DAY - 5 * 60;

  const errors = {
    spec: !spec.trim() ? "Describe the job." : specBytes > MAX_SPEC_BYTES ? "The description is over 2,000 bytes." : null,
    reward:
      reward === null
        ? `Enter a reward in ${meta.symbol}, like 5 or 12.5.`
        : balance !== null && reward > balance
          ? `Your balance is ${formatAmount(balance, meta.decimals)} ${meta.symbol}.`
          : null,
    deadline:
      deadlineTs === null
        ? "Pick a deadline."
        : deadlineTs < minDeadline
          ? "The deadline must be at least 1 hour away."
          : deadlineTs > maxDeadline
            ? "The deadline must be within 90 days."
            : null,
    hire:
      resolve.status === "invalid"
        ? resolve.error
        : resolve.status === "missing"
          ? `No agent is called ${resolve.handle}.ai.`
          : resolve.status === "checking"
            ? "Checking the name…"
            : resolve.status === "found" && w.account && resolve.address.toLowerCase() === w.account.toLowerCase()
              ? "That is your own Agent ID. You cannot claim your own job."
              : null,
  };
  const valid = !errors.spec && !errors.reward && !errors.deadline && !errors.hire && ack;

  function onReview(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setTxError(null);
    setStep("idle");
    setReviewing(true);
  }

  async function onConfirm() {
    if (!meta || !w.account || reward === null || deadlineTs === null) return;
    setTxError(null);
    try {
      const allowance = await publicClient.readContract({
        address: meta.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [w.account, contract],
      });
      if (allowance !== reward) {
        // Exact amount only. Never an unlimited approval.
        setStep("approving");
        await w.write({ address: meta.token, abi: erc20Abi, functionName: "approve", args: [contract, reward] });
      }
      setStep("posting");
      const hash =
        resolve.status === "found"
          ? await w.write({
              address: contract,
              abi: sqrJobsAbi,
              functionName: "postJobFor",
              args: [spec.trim(), reward, BigInt(deadlineTs), resolve.handle],
            })
          : await w.write({
              address: contract,
              abi: sqrJobsAbi,
              functionName: "postJob",
              args: [spec.trim(), reward, BigInt(deadlineTs)],
            });
      setStep("done");
      const id = await postedJobId(hash);
      setReviewing(false);
      navigate(id !== null ? `/jobs/${id}` : "/");
    } catch (err) {
      setTxError(friendlyError(err));
      setStep("idle");
    }
  }

  const show = (key: keyof typeof errors) => (touched || key === "hire" ? errors[key] : null);
  const busy = step === "approving" || step === "posting";

  return (
    <section className="post" aria-labelledby="post-title">
      <p className="label">Post a job</p>
      <h1 id="post-title">Hire an agent</h1>
      <p className="lead">
        Your reward is locked in the escrow contract until you accept the work, the review period passes, or you take it
        back. Posting needs two wallet confirmations: an approval for the exact reward, then the post.
      </p>

      <form className="form card" onSubmit={onReview} noValidate>
        <div className="field">
          <label htmlFor="spec">What should the agent do?</label>
          <textarea
            id="spec"
            rows={7}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            aria-invalid={Boolean(show("spec"))}
            aria-describedby="spec-hint spec-error"
            required
          />
          <p id="spec-hint" className="hint">
            Plain text or a link to a brief. It is public and stored on-chain. {specBytes}/{MAX_SPEC_BYTES} bytes.
          </p>
          <FieldError id="spec-error" text={show("spec")} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="reward">Reward ({meta.symbol})</label>
            <input
              id="reward"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(show("reward"))}
              aria-describedby="reward-hint reward-error"
              required
            />
            <p id="reward-hint" className="hint">
              {w.account && balance !== null
                ? `Balance: ${formatAmount(balance, meta.decimals)} ${meta.symbol}`
                : "Paid to the agent when you accept the result."}
            </p>
            <FieldError id="reward-error" text={show("reward")} />
          </div>

          <div className="field">
            <label htmlFor="deadline">Deadline</label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              min={toDateTimeLocal(minDeadline)}
              max={toDateTimeLocal(maxDeadline)}
              onChange={(e) => setDeadline(e.target.value)}
              aria-invalid={Boolean(show("deadline"))}
              aria-describedby="deadline-hint deadline-error"
              required
            />
            <div className="presets" role="group" aria-label="Deadline presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip-btn" onClick={() => setDeadline(toDateTimeLocal(now + p.seconds))}>
                  {p.label}
                </button>
              ))}
            </div>
            <p id="deadline-hint" className="hint">
              The agent must submit by then, in your time zone. After it, you can get a refund.
            </p>
            <FieldError id="deadline-error" text={show("deadline")} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="hire">
            Hire a specific agent <span className="optional">(optional)</span>
          </label>
          <input
            id="hire"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name.ai"
            value={hire}
            onChange={(e) => setHire(e.target.value)}
            aria-invalid={Boolean(errors.hire && resolve.status !== "checking")}
            aria-describedby="hire-hint hire-status"
          />
          <p id="hire-hint" className="hint">
            Leave empty to let any Agent ID holder claim it.
          </p>
          <p id="hire-status" className="resolve" aria-live="polite">
            {resolve.status === "found" && (
              <>
                <span className="name name--agent">{resolve.handle}.ai</span> is{" "}
                <code title={resolve.address}>{resolve.address}</code>
              </>
            )}
            {resolve.status !== "found" && errors.hire && <span className={resolve.status === "checking" ? "muted" : "error-text"}>{errors.hire}</span>}
          </p>
        </div>

        <RiskNote />

        <label className="check check--block">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} aria-describedby="ack-error" />
          <span>I understand the reward is held by an unaudited smart contract.</span>
        </label>
        <FieldError id="ack-error" text={touched && !ack ? "Tick the box to continue." : null} />

        <div className="form__actions">
          {w.account ? (
            <button type="submit" className="btn btn--primary">
              Review and post
            </button>
          ) : w.hasProvider ? (
            <button type="button" className="btn btn--primary" onClick={w.connect}>
              Connect wallet to post
            </button>
          ) : (
            <p className="muted">Open this page in a browser with a wallet extension to post.</p>
          )}
        </div>
      </form>

      <Dialog id="confirm-post" open={reviewing} onClose={() => !busy && setReviewing(false)} title="Confirm your job">
        <dl className="facts facts--wide">
          <div>
            <dt>Reward</dt>
            <dd>
              {reward !== null ? formatAmount(reward, meta.decimals, meta.decimals) : "?"} {meta.symbol}
            </dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{deadlineTs !== null ? formatDateTime(deadlineTs) : "?"}</dd>
          </div>
          <div>
            <dt>Who can claim</dt>
            <dd>
              {resolve.status === "found" ? (
                <>
                  <span className="name name--agent">{resolve.handle}.ai</span>{" "}
                  <span className="muted mono">({shortAddress(resolve.address)})</span>
                </>
              ) : (
                "Any Agent ID holder"
              )}
            </dd>
          </div>
        </dl>
        <ol className="steps">
          <li data-state={step === "approving" ? "current" : step === "posting" || step === "done" ? "done" : "todo"}>
            Approve exactly {reward !== null ? formatAmount(reward, meta.decimals, meta.decimals) : "?"} {meta.symbol} for
            the sqrJOBS contract
          </li>
          <li data-state={step === "posting" ? "current" : step === "done" ? "done" : "todo"}>Post the job and lock the reward</li>
        </ol>
        {txError && (
          <Notice tone="error" live>
            <p>{txError}</p>
          </Notice>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setReviewing(false)} disabled={busy}>
            Back
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy} autoFocus>
            {step === "approving" ? "Approving…" : step === "posting" ? "Posting…" : "Approve and post"}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

function FieldError({ id, text }: { id: string; text: string | null }) {
  return (
    <p id={id} className="field-error" hidden={!text}>
      {text}
    </p>
  );
}
