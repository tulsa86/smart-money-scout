# Gamble Zone MVP trial specification (draft freeze candidate)
Version: MVP-1.0. Status: PRE-LAUNCH; no session counts until a prospective decision is committed and the execution path passes CI.

## Purpose
Thirty consecutive eligible US equity market sessions to assess operational reliability, costs and preliminary performance. Not proof of an investment edge. Simulated orders only.

## Universe and signal
Fixed universe SPY, QQQ, NVDA, AMD, TSLA. Selection is limited and not representative of a market-wide scanner. For each symbol, use the latest fully completed regular session's 5-minute bars, plus completed prior-session volume baseline. Score = (prior close / prior open - 1) * (prior session volume / mean prior-session volume), eligible only when momentum > 0 and relative volume > 1. Highest score wins, ticker alphabetical tie-break. No qualifying candidate: SKIP. No discretionary fallback. Do not revise rules during trial.

## Portfolio and execution
One virtual $1,000 cash account. Maximum one selected candidate per session. Whole shares only, allocation capped at 25% of **starting** cash ($250), not a promise of a fill. If one share is unaffordable including costs, record SKIP_UNAFFORDABLE. Candidate decision must be committed before target-session opening. Simulate buy at target regular-session open and sell at that session's regular close; never use session high/low to choose exits. Both fills are modeled retrospectively using data from the completed session and must be labeled SIMULATED, not actual or executable fills. Apply adverse slippage per side; primary assumption 5 bps per side, sensitivity 10 and 25 bps per side. Track missed, incomplete, stale and unavailable evidence separately from verified market no-fill.

## Session policy
An eligible session is a scheduled NYSE regular or shortened trading session. Count every eligible session after trial activation, including no-signal, unaffordable, missing-data, failed-run, and no-fill days. Do not backfill missing pre-session decisions or rewrite prior records. Missing decision = MISSED_DECISION, not a trade. Half-days require the exchange-specific close; a missing final bar is not a fill. A run interrupted before complete evidence is available remains PENDING/INCOMPLETE until resolved, never silently omitted. Freeze eligibility/calendar logic before launch.

## Benchmarks and reporting
Report ending cash, realized P&L, session-level returns, no-trade and missing-evidence counts. Compare with SPY over the same regular-session open-to-close windows (flat overnight, identical sizing/cost convention clearly disclosed); report SPY buy-and-hold separately if desired, never substitute close-to-close for matched intraday performance. A seeded deterministic random-pick null from the same universe is secondary and must use the same timing and costs. No claim of statistically significant profitability after 30 sessions.

## Trial gate
At 30 eligible sessions, stop and review completeness, timestamp integrity, fill realism, sensitivity at 5/10/25 bps per side, and benchmarks. A positive result alone is insufficient for live trading. Decide whether to continue prospective testing, revise for a *new* trial, or stop. No real orders, broker routing, or automatic extension.

## Pre-launch blockers
1. Connect existing selective pre-session journal to one persistent ledger with causal entry/exit evidence.
2. Establish NYSE calendar including holidays and shortened sessions, missed-run policy, and append-only session outcome enforcement.
3. Add end-to-end tests and verify CI. Then freeze/tag rules before session 1.

Historical replay and prior Gamble Zone experiments are excluded from the prospective results.
