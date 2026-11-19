import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; data: T };

/** Run `load` when `deps` change; `reload()` runs it again without flashing the loading state. */
export function useAsync<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ status: "ready", data }),
      (err: unknown) => !cancelled && setState({ status: "error", error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return [state, reload];
}
