# Frontend + Backend Wiring Plan — SSE Streaming + Real Data

## Overview

Wire the NXTvue React frontend to the Python FastAPI backend using **Server-Sent Events (SSE)** for all long-running operations (analysis, compare, portfolio). The current backend uses blocking HTTP POSTs that would time out at the network layer for 1–3 minute Bob LLM calls. SSE keeps the connection alive and streams progress events as they happen.

**Backend changes required:** Add 3 new SSE streaming endpoints + file upload for portfolio.  
**Frontend changes:** API client, 3 hooks, 5 new components, wire 4 pages.  
**Design system:** Untouched. All existing UI components used as-is.

---

## Current Backend Endpoints (blocking — kept as-is for CLI/health use)

```
GET  /health
GET  /api/indices                     ← already streaming-safe (fast)
POST /api/v1/analysis/stock           ← blocking, NOT used by new UI
POST /api/v1/analysis/compare         ← blocking, NOT used by new UI
POST /api/v1/analysis/portfolio       ← blocking JSON, NOT used by new UI
GET  /api/v1/reports/{filename}       ← file serve, kept as-is
```

## New SSE Endpoints to Add

```
GET  /api/v1/stream/stock?ticker=MSFT&market=us&year=2026
GET  /api/v1/stream/compare?a=NETWEB&ma=india&b=KPIT&mb=india&year=2026
POST /api/v1/stream/portfolio          ← multipart: file (optional) + year
GET  /api/v1/stream/portfolio/default?year=2026  ← uses server-side holdings.xlsx
```

## SSE Event Shape (all endpoints emit same schema)

```json
data: {"status": "fetching",   "message": "Fetching financial data...",       "progress": 10}
data: {"status": "analyzing",  "message": "Generating AI report...",          "progress": 40}
data: {"status": "complete",   "message": "Report ready",                     "progress": 100,
       "result": { ...full response object... }}
data: {"status": "error",      "message": "Descriptive error text",           "progress": 0}
```

The `result` object on `complete` matches existing response shapes exactly — no frontend type changes needed if we reuse current Pydantic models.

---

## Architecture After Completion

```
User fills AnalysisForm
      ↓
useAnalysis hook opens EventSource to /api/v1/stream/stock?...
      ↓
Backend: yield fetching event → run _load_data → yield analyzing event → run _run_bob → yield complete
      ↓
React state updates on each event → AnalysisProgress phases advance
      ↓
On complete: ReportViewer renders final_memo + PDF download link
```

---

## Sub-Task 1 — API Types

**Status:** [ ] pending

**Intent:**  
Define TypeScript interfaces for all SSE event payloads and response objects. Single source of truth — all hooks and components import from here.

**Expected Outcomes:**
- `src/types/api.ts` exists and exports all types
- No `any` in the API layer

**Todo List:**
1. Create `src/types/api.ts`
2. Add `SseEvent` union type:
   ```ts
   type SseStatus = 'fetching' | 'analyzing' | 'complete' | 'error'
   interface SseEvent {
     status: SseStatus
     message: string
     progress: number        // 0–100
     result?: AnalysisResult | CompareResult | PortfolioResult
   }
   ```
3. Add `KeyMetrics` interface matching backend `key_metrics` dict keys:
   `current_price?, sector?, industry?, pe_ratio?, ttm_pe?, market_cap?, beta?, dividend_yield?, long_business_summary?`
4. Add `AnalysisResult`: `{ ticker, market, projection_year, final_memo, key_metrics: KeyMetrics, pdf_path? }`
5. Add `CompareResult`: `{ ticker_a, ticker_b, market_a, market_b, projection_year, final_memo, pdf_path? }`
6. Add `PortfolioHolding`: `{ ticker, company_name, market, qty, avg_cost, current_price?, invested, current_value, unrealised_pnl, gain_pct?, weight_pct }`
7. Add `PortfolioSummary`: `{ total_invested, total_value, total_pnl, total_gain_pct, num_holdings }`
8. Add `PortfolioMetrics`: `{ summary: PortfolioSummary, holdings: PortfolioHolding[], market_allocation, top_gainers, top_losers, concentration_flags, rebalancing_signals }`
9. Add `PortfolioResult`: `{ type: 'portfolio', projection_year, metrics: PortfolioMetrics, final_memo, pdf_path? }`
10. Add `IndexQuote`, `IndicesData` (move from `useIndices.ts`)
11. Add `ApiError`: `{ message: string; status: number }`

**Relevant Context:**
- Backend response shapes: `apps/backend/src/nxtvue/api/server.py` (Pydantic models lines 102–158)
- Portfolio metrics shape: `apps/backend/src/nxtvue/portfolio_analyser.py` `compute_portfolio_metrics()` return value (lines 213–227)
- Existing index types: `apps/frontend/nxtvue-web/src/hooks/useIndices.ts`

---

## Sub-Task 2 — Backend SSE Endpoints

**Status:** [ ] pending

**Intent:**  
Add 4 new streaming endpoints to `server.py`. Each uses FastAPI's `StreamingResponse` with `text/event-stream` content type to yield SSE events. The blocking work (`_load_data`, `_run_bob`) runs in a thread pool via `asyncio.run_in_executor` so it doesn't block the event loop. The existing blocking POST endpoints are kept untouched.

**Expected Outcomes:**
- `GET /api/v1/stream/stock` streams fetching → analyzing → complete events
- `GET /api/v1/stream/compare` streams the same phases for two tickers
- `POST /api/v1/stream/portfolio` accepts multipart `file` + `year` query param, streams same events
- `GET /api/v1/stream/portfolio/default` uses the server-side `holdings.xlsx`, streams same events
- All endpoints emit `data: {...}\n\n` formatted SSE lines
- On error, emits `{"status": "error", "message": "..."}` then closes stream

**Todo List:**
1. Add `sse_event(data: dict) -> str` helper at module level in `server.py`:
   ```python
   import json
   def sse_event(data: dict) -> str:
       return f"data: {json.dumps(data)}\n\n"
   ```
2. Add `GET /api/v1/stream/stock` endpoint:
   - Query params: `ticker: str`, `market: str = "india"`, `year: int = 2026`
   - Returns `StreamingResponse(generator(), media_type="text/event-stream")`
   - Generator:
     - yield `sse_event({"status": "fetching", "message": "Fetching financial data...", "progress": 10})`
     - run `_load_data(ticker, market)` in executor
     - yield `sse_event({"status": "analyzing", "message": "Generating AI report...", "progress": 40})`
     - run `_run_bob(prompt)` in executor
     - save PDF
     - yield `sse_event({"status": "complete", ..., "result": {...}, "progress": 100})`
     - on exception: yield `sse_event({"status": "error", "message": str(exc), "progress": 0})`
   - Add `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers (required for SSE through proxies)
3. Add `GET /api/v1/stream/compare` endpoint:
   - Query params: `a: str`, `ma: str = "india"`, `b: str`, `mb: str = "india"`, `year: int = 2026`
   - Fetch both tickers concurrently in the thread pool before the Bob call
   - Same 3-phase stream: fetching → analyzing → complete
4. Add helper `_run_portfolio_sse(df: pd.DataFrame, year: int)` that runs fetch_current_prices + compute_portfolio_metrics + _run_bob + save_pdf and returns the result dict — used by both portfolio endpoints
5. Add `POST /api/v1/stream/portfolio` endpoint:
   - Uses `File(...)` from `fastapi import File, UploadFile`
   - Query param: `year: int = 2026`
   - Write uploaded file to a temp path, call `load_holdings(temp_path)`, then `_run_portfolio_sse`
   - Same 3-phase stream
6. Add `GET /api/v1/stream/portfolio/default` endpoint:
   - Query param: `year: int = 2026`
   - Resolves the server-side `holdings.xlsx` path (relative to `server.py` location, going up to project root)
   - Calls `load_holdings(path)` then `_run_portfolio_sse`
   - Same 3-phase stream
7. Add `from fastapi import File, UploadFile` and `from fastapi.responses import StreamingResponse` to imports
8. Add `asyncio` generator pattern — use `async def` with `yield` inside an `async_generator` wrapper, or use a sync generator passed to `StreamingResponse`

**Relevant Context:**
- `apps/backend/src/nxtvue/api/server.py` — add after existing routes (line 335+)
- `apps/backend/src/nxtvue/report_generator.py` — `_load_data()`, `_compact_data()`, `_run_bob()`, `REPORT_SYSTEM_PROMPT` are all importable
- `apps/backend/src/nxtvue/portfolio_analyser.py` — `load_holdings()`, `fetch_current_prices()`, `compute_portfolio_metrics()`
- FastAPI `StreamingResponse` with `text/event-stream` keeps connection open through long calls
- The existing `_run_bob()` is synchronous (subprocess) — must run in `loop.run_in_executor(None, fn)`
- `holdings.xlsx` is at project root: resolve as `os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "holdings.xlsx")`

**SSE Generator Pattern (sync generator approach — simplest for FastAPI):**
```python
from fastapi.responses import StreamingResponse

@app.get("/api/v1/stream/stock")
async def stream_stock(ticker: str, market: str = "india", year: int = 2026):
    async def generate():
        loop = asyncio.get_event_loop()
        yield sse_event({"status": "fetching", "message": "Fetching financial data...", "progress": 10})
        try:
            data = await loop.run_in_executor(None, lambda: _load_data(ticker.upper(), market))
            yield sse_event({"status": "analyzing", "message": "Generating AI report...", "progress": 40})
            # build prompt and run bob...
            result = await loop.run_in_executor(None, lambda: _run_bob(prompt))
            yield sse_event({"status": "complete", ..., "progress": 100})
        except Exception as exc:
            yield sse_event({"status": "error", "message": str(exc), "progress": 0})
    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

---

## Sub-Task 3 — API Client (Frontend)

**Status:** [ ] pending

**Intent:**  
Thin frontend API layer. SSE connections use the native `EventSource` API (GET endpoints). The portfolio file upload uses a regular `fetch` POST with `ReadableStream` reader for SSE. A utility wraps both patterns into a single `openSseStream()` function.

**Expected Outcomes:**
- `src/api/client.ts` — `openSseStream(url, onEvent, onError, options?)` wraps both `EventSource` (GET) and `fetch`+`ReadableStream` (POST with file)
- `src/api/analysis.ts` — URL builders for all 4 stream endpoints + `getReportUrl()`
- `src/api/index.ts` — re-exports

**Todo List:**
1. Create `src/api/client.ts`:
   - `openSseStream(url: string, onEvent: (e: SseEvent) => void, onError: (e: Error) => void): () => void`
     - Uses `EventSource` for GET requests (stock, compare, portfolio/default)
     - Returns a cleanup function that closes the connection
   - `openSsePost(url: string, body: FormData, onEvent: (e: SseEvent) => void, onError: (e: Error) => void): AbortController`
     - Uses `fetch` with `ReadableStream` reader for POST (portfolio file upload)
     - Parses `data: {...}\n\n` lines manually from the stream chunks
     - Returns `AbortController` for cancellation
2. Create `src/api/analysis.ts`:
   - `stockStreamUrl(ticker: string, market: string, year: number): string`
   - `compareStreamUrl(a: string, ma: string, b: string, mb: string, year: number): string`
   - `portfolioDefaultStreamUrl(year: number): string`
   - `portfolioUploadStream(file: File, year: number, onEvent, onError): AbortController` — builds FormData and calls `openSsePost`
   - `getReportUrl(filename: string): string` — `/api/v1/reports/${filename}`
3. Create `src/api/index.ts` — re-exports all functions

**Relevant Context:**
- `EventSource` only supports GET — portfolio file upload needs `fetch` + stream reader
- Vite proxy already forwards `/api/*` → `http://localhost:8000` — no base URL config needed
- `data: {...}\n\n` SSE line format must be parsed in the fetch stream reader: split chunks by `\n`, filter lines starting with `data: `, JSON.parse the rest

---

## Sub-Task 4 — Shared UI Components

**Status:** [ ] pending

**Intent:**  
Build the 5 new components needed across all pages. All use existing design system primitives (Button, Card, Badge, Input). No new CSS.

**Expected Outcomes:**
- `AnalysisForm` — ticker + market + year form
- `AnalysisProgress` — 3-phase SSE progress display
- `ReportViewer` — renders `final_memo` + PDF download
- `FileUploadInput` — drag-drop + "use default" for portfolio
- All components importable and typed

**Todo List:**
1. Create `src/components/analysis/AnalysisForm.tsx`:
   - `ticker` text input — auto-uppercases on change, trims whitespace
   - `market` toggle — two-button group "India" / "US" (use existing `Button` with `outline`/`primary` variants)
   - `year` selector — button group: 2025, 2026, 2027
   - "Run Analysis" submit button (`Button` with `loading` prop when status is not idle)
   - Props: `onSubmit(ticker, market, year)`, `loading: boolean`, `defaultTicker?: string`, `defaultMarket?: string`
2. Create `src/components/analysis/AnalysisProgress.tsx`:
   - Shows 3 phases based on `status` prop:
     - `fetching`: spinner + "Fetching financial data..." + elapsed seconds counter
     - `analyzing`: spinner + "Generating AI report — this takes 1–3 minutes" + elapsed seconds
     - `complete`: green checkmark + "Report ready"
   - Elapsed counter runs via `setInterval` from when `status` first becomes non-idle
   - Props: `status: SseStatus`, `message: string`, `progress: number`
   - Use existing `LoadingState` spinner animation style
3. Create `src/components/analysis/ReportViewer.tsx`:
   - Accepts `finalMemo: string` (plain text with `##` headings from Bob)
   - Parses `##` and `###` lines into `<h2>`/`<h3>` tags, rest into `<p>` tags
   - Wraps output in existing `Card` with `CardContent`
   - "Download PDF" `<a>` tag pointing to `getReportUrl(filename)` — props accept `pdfFilename?: string`
   - If `pdfFilename` is null, hide the download button
4. Create `src/components/forms/FileUploadInput.tsx`:
   - Drag-drop zone: dashed border, accepts `.xlsx` and `.csv` MIME types only
   - Click-to-browse: hidden `<input type="file" accept=".xlsx,.csv">` triggered by clicking the zone
   - Shows selected filename + size when file is chosen
   - Below the dropzone: subtle text button "Don't have a file? Run analysis with our default tech portfolio"
   - Inside zone: small "Download template" link pointing to a template xlsx (create as static asset or generate on click)
   - Props: `onFile(file: File)`, `onUseDefault()`, `disabled?: boolean`
5. Ensure all components export typed props interfaces

**Relevant Context:**
- `apps/frontend/nxtvue-web/src/components/feedback/LoadingState.tsx` — spinner variants to reuse
- `apps/frontend/nxtvue-web/src/components/ui/Button.tsx` — `loading`, `variant`, `size` props
- `apps/frontend/nxtvue-web/src/components/ui/Card.tsx` — Card, CardContent, CardHeader
- `apps/frontend/nxtvue-web/src/utils/cn.ts` — class merging utility

---

## Sub-Task 5 — Hooks

**Status:** [ ] pending

**Intent:**  
Three hooks, one per analysis mode. Each manages SSE state machine: `idle → fetching → analyzing → complete | error`. They open/close EventSource connections and own the result state.

**Expected Outcomes:**
- `useAnalysis`, `useCompare`, `usePortfolio` hooks in `src/hooks/`
- Each returns `{ status, message, progress, result, error, run, reset }`
- Cleanup on unmount (close EventSource / abort fetch)

**Todo List:**
1. Create `src/hooks/useAnalysis.ts`:
   - State: `status: SseStatus | 'idle'`, `message`, `progress`, `result: AnalysisResult | null`, `error`
   - `run(ticker, market, year)`:
     - Reset state to idle
     - Open `EventSource` via `stockStreamUrl()`
     - On each `message` event: parse JSON, update state
     - On `complete`: set result, close EventSource
     - On `error`: set error message, close EventSource
   - `reset()`: clears result and returns to idle
   - Cleanup: close EventSource on unmount
   - Return: `{ status, message, progress, result, error, run, reset }`
2. Create `src/hooks/useCompare.ts`:
   - Same pattern as `useAnalysis`
   - `run(a, ma, b, mb, year)` — opens `compareStreamUrl()`
   - Result type: `CompareResult`
3. Create `src/hooks/usePortfolio.ts`:
   - Two entry points:
     - `runWithFile(file: File, year: number)` — calls `portfolioUploadStream()` (POST fetch stream)
     - `runDefault(year: number)` — opens `EventSource` on `portfolioDefaultStreamUrl()`
   - Same state machine
   - Result type: `PortfolioResult`
   - Cleanup: close EventSource or call `abortController.abort()` on unmount

**Relevant Context:**
- `src/api/analysis.ts` — all URL builders and stream openers
- `src/types/api.ts` — `SseEvent`, result types
- EventSource cleanup: `source.close()` in `useEffect` return function

---

## Sub-Task 6 — Page Wiring: AnalysisPage

**Status:** [ ] pending

**Intent:**  
Replace all hardcoded `AAPL_DATA` / `RELIANCE_DATA` in `AnalysisPage.tsx` with live data from `useAnalysis`. Show form at top. Wire URL param to pre-fill form. Keep the 13-section card layout as the display shell — populate it from `result.key_metrics` and `result.final_memo`.

**Expected Outcomes:**
- No hardcoded data objects remain in `AnalysisPage.tsx`
- Form visible at top; submitting it triggers the SSE stream
- Progress component shown during loading phases
- On complete: `ReportViewer` renders the report; key metrics cards at top show real values
- URL param `:ticker` (format: `TICKER` or `TICKER:market`) pre-fills the form

**Todo List:**
1. Remove `AAPL_DATA`, `RELIANCE_DATA` constant objects from the file
2. Add `useAnalysis` hook at the top of the component
3. Add `AnalysisForm` at the top of the page, above the existing section cards
   - `defaultTicker`: parsed from URL param `:ticker` (split on `:` to get market too)
   - `loading`: `status !== 'idle' && status !== 'complete' && status !== 'error'`
   - `onSubmit`: calls `useAnalysis.run(ticker, market, year)`
4. Add `AnalysisProgress` component below the form — visible when `status === 'fetching' | 'analyzing'`
5. When `status === 'complete'`:
   - Populate the Business Quality section card with `result.key_metrics.long_business_summary`
   - Populate the Valuation section metrics with `result.key_metrics` (pe_ratio, ttm_pe, price_to_book, etc.)
   - Render `ReportViewer` with `result.final_memo` — this becomes section 12/13 area
   - Show `pdfFilename={result.ticker.toUpperCase() + '.pdf'}` in ReportViewer
6. When `status === 'error'`: render `ErrorState` with the error message
7. When `status === 'idle'`: render the existing `EmptyState` with "analysis" variant
8. Update `App.tsx` route: rename `:asset` param to `:ticker` for clarity

**Relevant Context:**
- `apps/frontend/nxtvue-web/src/pages/analysis/AnalysisPage.tsx` — current 13-section structure
- `apps/frontend/nxtvue-web/src/components/feedback/EmptyState.tsx` — has `analysis` variant
- `apps/frontend/nxtvue-web/src/components/feedback/ErrorState.tsx` — use for error display
- `apps/frontend/nxtvue-web/src/App.tsx` — route `/analysis/:asset` to rename

---

## Sub-Task 7 — Page Wiring: ComparePage

**Status:** [ ] pending

**Intent:**  
Wire the existing 2-asset selector in `ComparePage.tsx` to `useCompare`. The selector UI already works — just connect the Compare button to the real SSE stream. Remove mock data objects.

**Expected Outcomes:**
- Clicking Compare triggers `useCompare.run(a, ma, b, mb, year)` with the selected tickers
- `AnalysisProgress` shown during stream
- `ReportViewer` renders comparison report with PDF download on complete
- Hardcoded RELIANCE/TCS/HDFCBANK mock data objects removed

**Todo List:**
1. Remove hardcoded mock comparison dataset objects
2. Add `useCompare` hook
3. Wire the existing "Compare" button `onClick` to `useCompare.run()`
   - Extract `ticker_a`, `market_a`, `ticker_b`, `market_b` from existing asset selector state
   - Add year selector (2025/2026/2027) near the Compare button
4. Show `AnalysisProgress` when `status === 'fetching' | 'analyzing'`
5. Show `ReportViewer` with `result.final_memo` when `status === 'complete'`
   - `pdfFilename`: `${a.toUpperCase()}_vs_${b.toUpperCase()}.pdf`
6. Show error state on failure
7. Keep the existing summary cards and scorecard table visible as UI chrome — they render placeholders until a result is available

**Relevant Context:**
- `apps/frontend/nxtvue-web/src/pages/compare/ComparePage.tsx` — asset selector state already tracks selected tickers

---

## Sub-Task 8 — Page Wiring: PortfolioPage

**Status:** [ ] pending

**Intent:**  
Add `FileUploadInput` to `PortfolioPage.tsx` above the existing tab layout. Wire both upload path and "use default" path through `usePortfolio`. On success, populate the Holdings tab with real data, Key Stats with real P&L numbers, and add a new Report tab with `ReportViewer`.

**Expected Outcomes:**
- `FileUploadInput` visible at top of portfolio page when no result loaded
- "Use default" button triggers default holdings analysis instantly
- Holdings tab table populated from `result.metrics.holdings`
- Key Statistics populated from `result.metrics.summary`
- New "Report" tab added with `ReportViewer` showing `result.final_memo`
- PDF download in Report tab
- Hardcoded mock holdings removed

**Todo List:**
1. Remove hardcoded mock holdings/portfolio data objects
2. Add `usePortfolio` hook
3. Render `FileUploadInput` at page top when `status === 'idle'` or `status === 'error'`
   - `onFile`: calls `usePortfolio.runWithFile(file, year)`
   - `onUseDefault`: calls `usePortfolio.runDefault(year)`
4. Show `AnalysisProgress` when loading
5. When `status === 'complete'`:
   - Hide `FileUploadInput` (or show collapsed)
   - Populate Holdings tab `ReportTable` rows from `result.metrics.holdings`
   - Map each holding to: Ticker | Company | Market | Qty | Avg Cost | Price | Invested | Value | P&L | Gain%
   - Populate Key Statistics section from `result.metrics.summary`
   - Add "Report" tab to existing tabs list → renders `ReportViewer` with `result.final_memo`
6. Add "Analyse another portfolio" button that calls `usePortfolio.reset()` to return to upload state
7. Add year selector (default 2026) next to the upload area

**Relevant Context:**
- `apps/frontend/nxtvue-web/src/pages/portfolio/PortfolioPage.tsx` — existing tabs: Overview, Holdings, Allocation, Performance
- `apps/frontend/nxtvue-web/src/components/charts/ChartContainer.tsx` — `ReportTable` for holdings rows
- `result.metrics.holdings` shape: defined in Sub-Task 1 `PortfolioHolding` type
- PDF filename is always `PORTFOLIO.pdf`

---

## Sub-Task 9 — Dashboard Search Navigation

**Status:** [ ] pending

**Intent:**  
Wire the dashboard search bar to navigate to `/analysis/:ticker` so the full analysis flow starts from the homepage. No API call from the dashboard — the navigation triggers the form pre-fill on `AnalysisPage`.

**Expected Outcomes:**
- Search bar has India/US market toggle
- Selecting a ticker or pressing Enter navigates to `/analysis/TICKER:market`
- `AnalysisPage` auto-parses `TICKER:market` from URL param and pre-fills the form

**Todo List:**
1. Update `DashboardPage.tsx` search section:
   - Add a 2-button market toggle (India / US) next to the existing search input
   - On Enter key or suggestion click: `navigate('/analysis/' + ticker + ':' + market)`
   - Keep existing dropdown suggestion list UI unchanged
2. Update `AnalysisPage.tsx` URL param parser (already planned in Sub-Task 6):
   - Parse `:ticker` param: if contains `:`, split into `[ticker, market]`; otherwise ticker only, market defaults to `india`
3. Confirm `App.tsx` route is `/analysis/:ticker` (rename if still `:asset`)

**Relevant Context:**
- `apps/frontend/nxtvue-web/src/pages/dashboard/DashboardPage.tsx` — search section with dropdown
- `react-router-dom` `useNavigate` and `useParams` hooks

---

## File Map Summary

```
src/
├── types/
│   └── api.ts                              NEW (Sub-Task 1)
├── api/
│   ├── client.ts                           NEW (Sub-Task 3)
│   ├── analysis.ts                         NEW (Sub-Task 3)
│   └── index.ts                            NEW (Sub-Task 3)
├── hooks/
│   ├── useIndices.ts                       EXISTING — no change
│   ├── useAnalysis.ts                      NEW (Sub-Task 5)
│   ├── useCompare.ts                       NEW (Sub-Task 5)
│   └── usePortfolio.ts                     NEW (Sub-Task 5)
├── components/
│   ├── analysis/
│   │   ├── AnalysisForm.tsx                NEW (Sub-Task 4)
│   │   ├── AnalysisProgress.tsx            NEW (Sub-Task 4)
│   │   └── ReportViewer.tsx                NEW (Sub-Task 4)
│   ├── forms/
│   │   └── FileUploadInput.tsx             NEW (Sub-Task 4)
│   └── ui/ layout/ feedback/ charts/       EXISTING — no changes
└── pages/
    ├── analysis/AnalysisPage.tsx           MODIFY (Sub-Task 6)
    ├── compare/ComparePage.tsx             MODIFY (Sub-Task 7)
    ├── portfolio/PortfolioPage.tsx         MODIFY (Sub-Task 8)
    ├── dashboard/DashboardPage.tsx         MODIFY (Sub-Task 9)
    └── all others                          NO CHANGE

apps/backend/src/nxtvue/api/server.py      MODIFY (Sub-Task 2) — add SSE endpoints
```

---

## Key Implementation Notes

1. **SSE connection pattern**: `EventSource` auto-reconnects on drop. Always call `source.close()` in `useEffect` cleanup and immediately after a `complete` or `error` event.

2. **POST upload SSE**: `EventSource` does not support POST. For portfolio file upload, use `fetch` with `ReadableStream`:
   ```ts
   const resp = await fetch(url, { method: 'POST', body: formData, signal: controller.signal })
   const reader = resp.body!.getReader()
   // read chunks, split on '\n', filter 'data: ' lines, JSON.parse
   ```

3. **SSE line parsing**: Chunks from `ReadableStream` may split across event boundaries. Buffer incomplete lines across reads.

4. **FastAPI async generator**: Use `async def generate()` with `yield` inside the route handler. FastAPI handles the async generator automatically with `StreamingResponse`.

5. **No timeout changes needed**: SSE keeps the HTTP connection alive for its entire duration. The browser does not apply a request timeout to `EventSource` connections.

6. **PDF download**: Use `<a href="/api/v1/reports/MSFT.pdf" download="MSFT.pdf">` — no fetch needed, the browser downloads directly.

7. **Template download**: `FileUploadInput` template link can point to a static `/holdings-template.xlsx` placed in `apps/frontend/nxtvue-web/public/` — copy the root `holdings.xlsx` there as a blank template.
