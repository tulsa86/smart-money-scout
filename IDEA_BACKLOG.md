# Smart Money Scout: Idea Backlog

This is the parking lot for ideas, **not** a commitment to build them. Preserve the reasoning so ideas can be revisited after the first end-to-end experiment works.

## Build now: first complete experiment
- **Reliable historical intraday OHLCV data**: Timestamped 5-minute candles, source provenance, data limitations, and reproducible ingestion. Without this, intraday backtests are fiction.
- **One deterministic entry strategy**: Closed-candle breakout plus volume confirmation. Baseline logic added in `src/stocks/candles.ts`; needs data and evaluation.
- **Trade simulator with exits**: Position sizing, stop/target/time exits, transaction costs, slippage, and no lookahead. Without exits there is no trade performance.
- **Honest performance report**: Trade log, net return, drawdown, comparison to matching-date S&P 500 benchmark, and limitations.

## Build later
- **30-day seasons**: Independent $1,000 paper portfolios, frozen rules during each season, end-of-season review, fresh starting balances, and archived results. Reason: disciplined iteration and comparable experiments. Prerequisite: validated simulator and repeatable data.
- **Automated intraday paper trading**: Scan, enter, manage, and exit positions throughout market hours, potentially after minutes or hours. Reason: opportunities don't last all day. Prerequisite: dependable timely market data and execution/scheduling infrastructure; GitHub Actions cannot guarantee exact-minute execution.
- **Multi-timeframe analysis**: Combine 5-minute entries with 15-minute context and daily trend. Reason: avoid chasing noise. Prerequisite: reliable candle data and evidence that it improves out-of-sample performance.
- **Additional independent strategies**: Momentum Hunter, Catalyst Chaser, Dip Buyer, Breakout Hunter, Experimental Strategy, and passive S&P 500 benchmark. Reason: compare approaches rather than assuming one wins. Prerequisite: first end-to-end strategy works.
- **Beginner-friendly Candle Lab UI**: Show candlesticks, signal explanations, and trade reasoning on iPhone. Reason: learn why/how decisions are made. Prerequisite: working analysis and dataset.

## Experimental / research first
- **Candlestick pattern recognition**: Test hammers, engulfing patterns, dojis, and other formations *with* context and volume; do not assume visual patterns predict returns.
- **Adaptive strategy selection / machine learning**: Learn from completed seasons, train on past data, validate on unseen periods, and promote only improvements that survive independent tests. Reason: gradual evidence-based improvement, not a bot rewriting rules mid-season.
- **Intraday time horizons down to minutes**: Evaluate 1-minute data and faster exits only if costs, liquidity, data quality, and scheduling allow credible results.
- **Catalyst and news analysis**: Use verified event timestamps and publicly available information at decision time to avoid lookahead bias.
- **Institutional/insider/congressional activity signals**: Evaluate public disclosure delays before treating them as useful trade signals.

## Rejected
- None recorded. Preserve rejected ideas here with the reason instead of silently forgetting them.

## Decision rule
Do not expand scope until a single strategy can ingest real historical data, generate signals, simulate realistic entries/exits, and produce an auditable report. No invented profits, data, fills, or claims of learning. Maintain the $0 additional-subscription constraint.
