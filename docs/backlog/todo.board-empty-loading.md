# Board stuck on "Loading jobs…" with no jobs

Issue: https://github.com/sqrDAO/sqrJOBS/issues/4

## Fix

In `web/src/pages/Board.tsx`, `loadMore` now clears `loading` when `nextPage` returns null. That happens when the contract has no jobs, or every job is already loaded.

## Verify

- [ ] With `jobCount() == 0` on mainnet, the board shows the empty state instead of "Loading jobs…".
- [ ] Web lint, test and build are green.
