# Investment Analysis Agent

A single Bob-powered report agent that produces a detailed, source-grounded investment report in the style of a senior financial analyst, risk manager, and investment manager.

## Data sources

- **Indian stocks:** Screener.in. The adapter collects the visible valuation snapshot, quarterly and annual tables, balance sheet, cash flow, growth summary, shareholding and announcements when available.
- **US stocks:** yFinance. The existing adapter collects company information, financial statements, cash flows, ownership, news and price history.

The report is instructed not to invent missing order-book, event, news, target-price or financial data. Missing data is explicitly identified.

## Usage

```bash
pip install -r requirements.txt
cp .env.example .env
# Add your Bob API key to .env

# Indian stock (default market)
python main.py NETWEB --market india --year 2026

# US stock
python main.py AAPL --market us --year 2026
```

The generated report includes:

1. Executive judgement
2. Business quality and sector positioning
3. Financial performance
4. Balance-sheet analysis
5. Order book and revenue visibility
6. Shareholding pattern
7. Valuation
8. End-year scenario projection
9. Growth potential versus stock-return potential
10. Key risks
11. Bullish and bearish monitoring triggers
12. Final investment judgement and practical stance

## Configuration

Only Bob is used for report generation. The application calls Bob through its OpenAI-compatible endpoint using `BOB_API_KEY`, `BOB_BASE_URL`, and `BOB_MODEL_NAME`.

## Important limitation

This is a research and education tool, not financial advice. Screener.in and yFinance do not guarantee complete coverage of order books, private contracts, events or all news. Review company filings, exchange disclosures and annual reports before making an investment decision.
