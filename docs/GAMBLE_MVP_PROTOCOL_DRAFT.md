# Gamble MVP Prospective Experiment Protocol — DRAFT, NOT APPROVED

Prepared: 2026-11-05. Status: **NOT FROZEN / NO COUNTED SESSIONS**.
Owner approval: **PENDING**. Approval date/time: **PENDING**.
This document is a proposed experiment design, not authorization to trade real money.

## Fixed strategy (existing code)
- Universe: SPY, QQQ, NVDA, AMD, TSLA.
- Input: prior completed full regular-session Alpaca IEX five-minute bars; momentum = close/open - 1; relative volume = prior-session volume / mean volume of available earlier complete sessions.
- Eligibility: momentum > 0 and relative volume > 1. Rank by momentum × relative volume; tie-break alphabetically. Otherwise SKIP.
- One selective decision per eligible session, before 09:30 America/New_York. No retrospective decisions.
- $1,000 starting simulated cash. Maximum $250 per round trip, whole shares, no leverage; no trade if unaffordable.
- Simulated entry: first regular five-minute bar open. Exit: final regular five-minute bar close. Five basis points slippage each side, zero commission assumption. No broker orders.
- Only full regular NYSE trading sessions; no early closes. Market calendar requires maintenance for extraordinary closures.

## Proposed evaluation rules requiring approval
- 30 consecutive *eligible calendar sessions* after an approved start date; count valid SKIP decisions as zero strategy P&L. Never replace failed/missed sessions with later dates without a separately approved amendment.
- Mark each eligible day as TRADE, SKIP, MISSING_DECISION, DATA_FAILURE, or UNSETTLED. Distinguish no signal from operational failure.
- Benchmark: $1,000 SPY buy-and-hold from first counted session open to final counted session close; same period, explicit treatment of distributions and benchmark transaction costs to be approved.
- Primary metric: strategy total return minus matched SPY total return, percentage points. Proposed exploratory success threshold: excess return > 0 pp, **provided at least 95% of eligible sessions have valid prospective decisions and settlements**. Otherwise INCONCLUSIVE.
- Secondary: trade count, win rate, max drawdown, number of SKIPs, missed sessions, data failures, data completeness.
- No signal, sizing, entry/exit, slippage, universe, benchmark, metric or threshold changes during the window. Any change starts a newly labeled version; never overwrite earlier records.
- The 30-session result is exploratory, not proof of predictive skill or permission for real-money trading.

## Preflight blockers
1. Confirm all automated checks and end-to-end same-day premarket decision-to-next-day settlement tests pass.
2. Verify live Alpaca IEX bar completeness and decide a transparent missing-bar policy.
3. Implement and test explicit calendar-day coverage, benchmark, and data-failure accounting.
4. Obtain dated user approval of this exact protocol and start date **before** the first counted decision.

**No counted sessions have been authorized.** Workflow schedule is disabled until approval and preflight completion.

Approval signature/name: ____________________
Approval date/time and timezone: ____________________
First counted session: ____________________
