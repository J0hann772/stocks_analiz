# Financial Modeling Prep (FMP) Stable API Reference

This document summarizes the current stable endpoints for the FMP API. These endpoints replace the legacy `/api/v3/` API which is deprecated for new users.

**Base URL:** `https://financialmodelingprep.com/stable`
**Authorization:** Add `?apikey=YOUR_API_KEY` to the URL.

## 1. Quotes & Prices

- **Real-Time Quote:** `/quote?symbol={symbol}`
- **Real-Time Short Quote:** `/quote-short?symbol={symbol}`
- **Batch Quotes:** `/batch-quote?symbols={symbol},{symbol}`
- **Company Profile:** `/profile?symbol={symbol}`

## 2. Historical Data (End of Day & Intraday)

- **Daily Historical Data (Full):** `/historical-price-eod/full?symbol={symbol}` (Replaces legacy `historical-price-full`)
- **Daily Historical Data (Light):** `/historical-price-eod/light?symbol={symbol}`
- **Intraday Chart (1min, 5min, 15min, 30min, 1hour, 4hour):** `/historical-chart/{interval}?symbol={symbol}`

## 3. Market Indexes & Constituents

- **S&P 500 Constituents:** `/sp500-constituent`
- **Nasdaq Constituents:** `/nasdaq-constituent`
- **Dow Jones Constituents:** `/dowjones-constituent`

## 4. Fundamental Data (Financial Statements)

- **Income Statement:** `/income-statement?symbol={symbol}`
- **Balance Sheet:** `/balance-sheet-statement?symbol={symbol}`
- **Cash Flow Statement:** `/cash-flow-statement?symbol={symbol}`
- **Key Metrics:** `/key-metrics?symbol={symbol}`
- **Financial Ratios:** `/ratios?symbol={symbol}`

## 5. Other Useful Endpoints

- **Company Search:** `/search-symbol?query={query}`
- **Stock Screener:** `/company-screener?{parameters}`
- **Economic Indicators:** `/economic-indicators?name={name}`
- **Earnings Calendar:** `/earnings-calendar`
- **Dividends Calendar:** `/dividends-calendar`

## Mapping from Legacy (v3) to Stable

| Legacy (v3)                                    | Stable                                                | Notes                                      |
| :--------------------------------------------- | :---------------------------------------------------- | :----------------------------------------- |
| `/api/v3/quote/{symbol}`                       | `/stable/quote?symbol={symbol}`                       | Symbol moved from path to query param.     |
| `/api/v3/historical-price-full/{symbol}`       | `/stable/historical-price-eod/full?symbol={symbol}`   | Path changed, symbol moved to query param. |
| `/api/v3/historical-chart/{interval}/{symbol}` | `/stable/historical-chart/{interval}?symbol={symbol}` | Symbol moved from path to query param.     |
| `/api/v3/profile/{symbol}`                     | `/stable/profile?symbol={symbol}`                     | Symbol moved from path to query param.     |
| `/api/v3/sp500_constituent`                    | `/stable/sp500-constituent`                           | Underscore changed to hyphen.              |

**Important Note for Agent:** Always consult this document when writing FMP API integration code to ensure usage of the correct new stable endpoints instead of legacy ones.
