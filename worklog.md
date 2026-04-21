# StatArb Screener - Work Log

---
Task ID: 1
Agent: Main Agent
Task: Initialize Next.js project environment

Work Log:
- Ran fullstack init script to set up Next.js 16 project
- Verified project structure and package.json
- Confirmed all dependencies (shadcn/ui, Zustand, TanStack Query, Recharts, Prisma) are available

Stage Summary:
- Project initialized at /home/z/my-project
- Dev server running on port 3000
- All UI components available in src/components/ui/

---
Task ID: 2
Agent: full-stack-developer subagent
Task: Build complete Statistical Arbitrage Screener application

Work Log:
- Updated Prisma schema with SyntheticInstrument model
- Ran db:push to create SQLite tables
- Created lib/bybit.ts - Bybit V5 API client (instruments, klines, tickers)
- Created lib/cointegration.ts - Full statistical engine (OLS, ADF test with Gauss-Jordan matrix inversion, Engle-Granger cointegration, half-life, correlation, batch scan)
- Created lib/normalization.ts - Z-score, min-max, percent change normalization, series alignment
- Created lib/synthetic.ts - Synthetic instrument calculations (price, kline, formula generation)
- Created 7 API routes (instruments, kline, cointegration, synthetics CRUD, synthetic chart, pair chart)
- Created 2 Zustand stores (screener-store, synthetic-store)
- Created ScreenerPanel component with instrument selector, scan parameters, results table, detail panel with spread and z-score charts
- Created SyntheticsPanel component with builder and saved synthetics list
- Created ChartPanel component with pair/synthetic modes, all timeframes, overlays (spread, z-score, Bollinger Bands)
- Created main page.tsx with sidebar navigation and tab-based content
- ESLint: PASSED (0 errors)

Stage Summary:
- Full application built and running
- Bybit API integration working (live data fetching)
- Dark trading terminal UI with cyan/teal accents
- All statistical functions have real implementations (no stubs)
- Database persistence for synthetic instruments
- In-memory caching for API responses

---
Task ID: 3
Agent: Main Agent
Task: Fix 4 critical bugs reported by user

Work Log:
- **Bug 1: P-Value always 1.000** - Found ROOT CAUSE: lagged differences in ADF test were misaligned by `lags` positions. The loop `for (let i = lag; i < dy.length; i++)` started from wrong index, causing the design matrix to have incorrect lagged difference values. This made the ADF test produce wrong statistics → always pValue ≈ 1.0.
  - Rewrote entire ADF test using Frisch-Waugh-Lovell (FWL) theorem for numerical stability
  - Replaced matrix inversion approach with Gram-Schmidt orthogonalization in `partialOut()` function
  - Capped max lags at `sqrt(n)` (max 8) instead of Schwert criterion that gave 14+ lags
  - Added iterative fallback: tries with decreasing lags until one works
  - Fixed the critical indexing bug: `for (let i = lags; i < dy.length; i++)` instead of `for (let i = lag; i < dy.length; i++)`
- **Bug 2: Fixed long/short determination** - Synthetic creation now correctly determines sides based on the cointegration relationship:
  - spread = Long symbol1 (coeff 1.0) - Short symbol2 (coeff = hedgeRatio)
  - Handles negative hedgeRatio case (both long with |hedgeRatio|)
  - Added "Synthetic Formula" explanation in the detail panel
  - Added "Direction" column in scan results showing "Long BTC - Short ETH"
- **Bug 3: Added coefficients display** - Hedge Ratio is now shown as a prominent badge in the scan results table. Added explanation text "Hedge Ratio = coefficient for Short leg". Added formula display in detail panel.
- **Bug 4: Fixed "Create Synthetic" from scan results** - Added `onSwitchTab` prop from page.tsx to ScreenerPanel. "Create Synthetic" now: fills legs correctly → switches to Synthetics tab → shows toast notification. "View Chart" also switches to Chart tab with the selected pair.
- Added `useEffect` in ChartPanel to react to `selectedPair` changes from screener

Stage Summary:
- P-Value bug FIXED - ADF test now produces correct statistics using FWL theorem
- Synthetic creation now properly determines long/short from cointegration relationship
- Hedge Ratio prominently displayed in scan results with explanation
- "Create Synthetic" button works and switches to Synthetics tab
- ESLint: PASSED (0 errors)
