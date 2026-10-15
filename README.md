# Smart Money Scout — Stage 1

A browser-local Solana research and paper-trading sandbox built with React, TypeScript and Vite. Every market quote and score is **MOCK DATA**. There are no network market requests, wallet connections, order execution connections, API keys or paid dependencies. No profitability is implied.

## Run locally

Use Node.js 24+ and npm:

```sh
npm install
npm test
npm run dev
```

Open the local URL Vite prints. Production build: `npm run build`. Serve `dist/` with any static host. Tests use Node's built-in runner and TypeScript stripping and can run before installing dependencies.

## Structure

- `src/main.tsx`: responsive React dashboard, research dialog, settings, history, activity and explicit reset confirmation.
- `src/style.css`: responsive dark UI; system font fallbacks, no external font requests.
- `src/engine/core.ts`: pure, independently testable accounting and order rules.
- `src/engine/storage.ts`: versioned localStorage adapter and storage interface.
- `src/engine/core.test.ts`: sizing, funds, max positions, fees, slippage, stop and take triggers, daily cutoff, accounting and persistence tests.
- `src/providers/market.ts`: deterministic mock provider and future DEX Screener / Helius interfaces.
- `src/strategy/score.ts`: explainable fixed mathematical scoring, no LLM-generated signals.
- `.github/workflows/pages.yml`: test, build and deploy workflow.

## How to use

Start with $100 cash and empty trade history. Research a scanner token to inspect sub-scores and risk flags, choose up to $10 inclusive of entry fees and open a paper position. Open positions appear on Overview. Advance mock market to move to the next deterministic sample and check stops / targets. This is manual stepping, never a live refresh. Close manually or let simulated exits execute on a step. Trade history distinguishes trigger and fill prices. Activity log includes errors and a JSON export of the complete local record. Settings configures fee and slippage basis points. Reset requires a separate confirmation.

## Engine conventions

Maximum three simultaneous positions, one per token; no leverage or shorts. Budget includes entry fee: notional = budget / (1 + fee rate). Buy fill = observed trigger × (1 + slippage); units = notional / fill. Default fee is 25 bps per side and slippage 50 bps per side; allowed ranges 0–500 and 0–1000 bps respectively. Stop / take-profit trigger thresholds are 90% / 120% of entry fill and remain fixed. Sell fill = observed trigger × (1 − slippage). Stop gaps fill at the observed price after adverse slippage, never at a guaranteed stop price. Exit fee is charged on gross sale proceeds. Recorded trade P/L subtracts both fees and entry budget. Cash never funds a position beyond available funds.

Equity = cash + units × current mock mark; unrealized P/L includes the paid entry fee but excludes hypothetical future exit costs. Realized P/L includes all actual simulated exit costs. Win rate = positive net closed trades / all closed trades (break-even trades count as non-wins). Chart points are recorded equity snapshots, starting at $100; there is no invented backtest or preloaded trading performance. All-time and 24h chart filters apply to actual recorded timestamps.

Daily entry cutoff uses net realized P/L for the current UTC calendar day: at −$5 or below, new entries are blocked; exits remain allowed. The cutoff resets on the next UTC date; it is not a latched maximum drawdown rule. Timestamps are local browser clock ISO timestamps. Rules run in the browser and can be altered by the device owner; this is not a security boundary.

## GitHub Pages

Push this directory as your repository root on branch `main`. In GitHub Settings → Pages → Source, select **GitHub Actions**. Run the included workflow or push to main. Vite uses `base: '/smart-money-scout/'` for the GitHub repository named `smart-money-scout`. The default public URL is `https://YOUR-USERNAME.github.io/smart-money-scout/`. For a differently named repository or custom domain, adjust the base path before building. No router fallback or server is needed. For manual deployment, upload the contents of `dist/`. GitHub availability and free-tier quotas apply. The included package-lock.json is committed with your source; CI uses `npm ci` for locked dependency installation.

## Persistence and limitations

Records stay in localStorage on the current browser and origin, including positions, settings, market step, trades, chart and logs. Refresh resumes the same step; it does not progress the market. Changing hosting origins starts a separate account. Clearing browser data removes records. There is no background monitoring, tab synchronization, real-time pricing, import, custody, tax calculation or real execution. Logs retain the latest 200 events; trades and history are retained until reset. Storage write failures are shown and rejected; invalid saved state is preserved with trading paused until reset. Export before resetting if you need an archive. Storage has browser quota limits; performance on large histories has not been benchmarked.

## Future integrations — not implemented

Implement `DexScreenerProvider` to normalize public Solana market snapshots and `HeliusWalletProvider` for wallet activity. Keep wallet activity separate from strategy evidence. Validate token identities, chain, decimals, response freshness and liquidity; handle CORS, timeouts, rate limits and missing data explicitly. Confirm current provider terms and free-tier availability. Helius credentials must never be bundled into this static frontend: an authenticated proxy would be a separate future backend stage. External responses need provenance, timestamps, error states and fixture-based contract tests. Do not change the MOCK DATA label or mix external prices with this demo's persisted mock ledger; create a separate explicitly identified data mode and ledger first. None of these interfaces enables real-money execution.

## Verification in this workspace

Dependency installation succeeded after enabling command-level sandbox network permission and selecting a writable cache (`npm install --cache /workspace/.npm-cache --fetch-retries=0 --fetch-timeout=30000`). The cloud HTTP policy was unrestricted and enforced, but without that permission the process received EPERM connecting to the configured proxy. The default `/home/agent/.npm` cache could not accept logs. Registry and proxy configuration were preserved. A package-lock.json is now included. All eight engine/storage tests pass on Node 24, and `npm run build` (TypeScript plus Vite) succeeds. Browser interaction/visual verification and deployment have not been performed. To run here, use `npm run dev` and open the URL printed by Vite. Fresh installations in this environment need the same network permission and writable cache; use `npm ci --cache /workspace/.npm-cache` with the lockfile.


## First publication from a local copy

1. Create a free **public** GitHub repository named `smart-money-scout`. Leave it empty (no generated README, license or .gitignore).
2. Extract the project ZIP and open a terminal inside the extracted `smart-money-scout` folder. Authenticate using `gh auth login` or your normal Git HTTPS/SSH credentials.
3. Run the following, replacing `YOUR-USERNAME`:

```sh
git init -b main
git add .
git commit -m "Prepare Smart Money Scout for GitHub Pages"
git remote add origin https://github.com/YOUR-USERNAME/smart-money-scout.git
git push -u origin main
```

4. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Deploy GitHub Pages → Run workflow → main → Run workflow**. Future pushes to `main` deploy automatically.
6. Wait for the build/deployment job to turn green. Open the URL shown in the deployment environment or visit `https://YOUR-USERNAME.github.io/smart-money-scout/` from your iPhone.

Upload the whole project, including `.github/workflows/pages.yml` and `package-lock.json`; do not upload `node_modules/`, `dist/`, cache directories or credentials. Paper-trading state is browser-local: the new Pages origin starts at $100 and does not copy your previous localhost data.
