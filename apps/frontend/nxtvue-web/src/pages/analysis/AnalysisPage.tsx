import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ReportTable } from '@/components/charts/ChartContainer'

// Rich 13-section analytical datasets matching frontend/results.tsx depth
const reportDatasets: Record<string, any> = {
  'AAPL': {
    name: 'Apple Inc.',
    symbol: 'AAPL',
    subtitle: '2026 Investment View',
    analysisDoc: 'Analysis: AAPL.pdf',
    judgementTag: 'High-Quality Hold / Valuation-Constrained Accumulate',
    judgementText: `Apple remains a premier global business franchise with exceptional capital efficiency and unmatched cash generation, but its valuation is stretched relative to medium-term growth rates.`,
    executiveSummary: [
      { label: 'Business outlook', text: 'Solid hardware replacement cycles and expanding high-margin services continue to anchor top-line stability and cash flow generation, though near-term hardware acceleration faces competitive headwinds.' },
      { label: 'Stock valuation', text: 'Richly valued across historical and relative metrics, trading at a trailing P/E of 38.17x, forward P/E of 34.58x, and an EV/EBITDA of 28.92x, pricing in significant perfection.' },
      { label: 'Risk-adjusted view', text: 'Asymmetric to the downside in the immediate term if multiple compression occurs, balanced by relentless capital return via massive share repurchases ($90.71B in FY2025) and resilient gross margins (46.91%).' },
    ],
    summaryNote: 'While Apple represents one of the lowest-risk operational and balance-sheet profiles in global equities, current valuation limits near-term multiple expansion, making disciplined entry and scenario-based position sizing essential for conservative investors.',
    
    // Section 1: Business Quality & Sector
    sec1Intro: 'Apple operates an unrivaled consumer technology ecosystem spanning premium hardware (iPhone, Mac, iPad, Wearables/Accessories) and high-margin recurring Services (App Store, Apple Pay, AppleCare, Cloud Services, Apple Music, Apple TV+, and digital advertising).',
    sec1Bullets: [
      { title: 'Moat & Ecosystem Stickiness', desc: 'The proprietary iOS/macOS platform locks in a massive global user base across enterprise, consumer, and education sectors, driving high switching costs and robust lifetime customer value.' },
      { title: 'Capital Efficiency', desc: 'Apple demonstrates exceptional capital efficiency, posting a Return on Invested Capital (ROIC) of 106.54% and Return on Equity (ROE) of 148.75%, enabled by an asset-light manufacturing model (capex intensity of 3.06%).' }
    ],
    sec1Outro: 'Positioned in the Consumer Electronics industry within the Technology sector, Apple outpaces broader benchmarks, with the Technology sector ETF (XLK) displaying strong relative momentum (+19.60% vs SPY 1-year).',

    // Section 2: Financial Performance
    sec2Intro: "Apple's financial statements reflect consistent margin expansion and strong free cash flow conversion despite uneven quarterly revenue fluctuations.",
    sec2Headers: ["Financial Metric", "FY2022", "FY2023", "FY2024", "FY2025", "TTM/Most Recent"],
    sec2Rows: [
      ["Total Revenue ($B)", "$394.33", "$383.29", "$391.04", "$416.16", "$466.82 (Sum 4Q)"],
      ["Gross Profit ($B)", "$170.78", "$169.15", "$180.68", "$195.20", "$227.53 (Sum 4Q)"],
      ["Gross Margin (%)", "43.31%", "44.13%", "46.21%", "46.91%", "46.91%"],
      ["Operating Income ($B)", "$119.44", "$114.30", "$123.22", "$133.05", "$154.86 (Sum 4Q)"],
      ["Operating Margin (%)", "30.29%", "29.82%", "31.51%", "31.97%", "32.62%"],
      ["Net Income ($B)", "$99.80", "$96.99", "$93.74", "$112.01", "$128.93"],
      ["Diluted EPS ($)", "$6.11", "$6.13", "$6.08", "$7.46", "$8.83"],
      ["Operating Cash Flow ($B)", "$122.15", "$110.54", "$118.25", "$111.48", "$146.72"],
      ["Free Cash Flow ($B)", "$111.44", "$99.58", "$108.81", "$98.77", "$107.72"]
    ],
    sec2Bullets: [
      { title: 'Earnings & Revenue Trends', desc: 'FY2025 annual revenue reached $416.16B (+6.43% YoY), and TTM net income expanded to $128.93B with diluted TTM EPS of $8.83.' },
      { title: 'Cash Conversion Quality', desc: 'Free cash flow conversion stands at 88.18%, and operating cash flow to net income is 99.53%, showing minimal earnings accrual risk (Sloan accrual ratio of 0.0015).' }
    ],

    // Section 3: Balance Sheet
    sec3Intro: 'Apple maintains an optimized capital allocation strategy featuring a net cash neutral objective via sustained debt issuance and aggressive share buybacks.',
    sec3Headers: ["Balance Sheet Item", "FY2022", "FY2023", "FY2024", "FY2025"],
    sec3Rows: [
      ["Cash, Equivalents & ST Inv ($B)", "$48.30", "$61.56", "$65.17", "$54.70"],
      ["Total Debt ($B)", "$132.48", "$111.09", "$106.63", "$98.66"],
      ["Net Debt ($B)", "$96.42", "$81.12", "$76.69", "$62.72"],
      ["Stockholders' Equity ($B)", "$50.67", "$62.15", "$56.95", "$73.73"],
      ["Working Capital ($B)", "-$18.58", "-$1.74", "-$23.41", "-$17.67"],
      ["Current Ratio", "-", "-", "-", "1.003x"],
      ["Debt-to-Equity", "-", "-", "-", "78.45%"]
    ],
    sec3Bullets: [
      { title: 'Solvency & Liquidity', desc: 'Total debt has steadily decreased from $132.48B in FY2022 to $98.66B in FY2025. Net debt stands at $62.72B. Cash and short-term liquid investments totaled $54.70B, with additional non-current available-for-sale securities of $77.72B.' },
      { title: 'Negative Retained Earnings', desc: 'Retained earnings stand at -$14.26B due to cumulative share repurchases exceeding cumulative net income, a deliberate balance-sheet optimization rather than operational distress.' },
      { title: 'Working Capital Dynamics', desc: "Negative working capital (-$17.67B) highlights Apple's negative cash conversion cycle, funding operations using vendor payables ($69.86B accounts payable)." }
    ],

    // Section 4: Order Book & Visibility
    sec4OrderBookDesc: 'Specific contract backlog and customer-by-customer order book figures are not reported for consumer hardware businesses.',
    sec4VisibilityDesc: 'Visibility is driven by seasonal product launch cadences (Q1 holiday spikes, evidenced by $143.76B revenue in the quarter ended 2025-12-31), recurring subscription and App Store revenues, and deferred revenue balances ($9.06B current deferred revenue as of FY2025).',
    sec4MonitoringPoints: [
      'Quarterly hardware unit shipments and Average Selling Prices (ASPs).',
      'Services annualized run rates and App Store gross merchandise volume.',
      'Supply-chain procurement reports and foundry lead times from key semiconductor suppliers.'
    ],

    // Section 5: Shareholding Pattern
    sec5Intro: "Apple's equity base is heavily anchored by global institutional investors and passive index managers.",
    sec5Headers: ["Shareholder Category / Top Holders", "Ownership Percentage", "Shares Held"],
    sec5Rows: [
      ["Institutional Ownership (Total)", "66.34%", "-"],
      ["Insider Ownership (Total)", "1.65%", "-"],
      ["BlackRock Inc.", "7.97%", "1,162,996,939"],
      ["Vanguard Capital Management LLC", "6.57%", "959,107,911"],
      ["State Street Corporation", "4.21%", "615,129,929"],
      ["Geode Capital Management, LLC", "2.54%", "371,336,543"],
      ["Vanguard Portfolio Management LLC", "2.29%", "334,119,156"],
      ["FMR, LLC", "2.23%", "325,348,754"],
      ["Morgan Stanley", "1.66%", "242,614,238"],
      ["JPMorgan Chase & Co.", "1.57%", "228,762,008"],
      ["Berkshire Hathaway, Inc.", "1.56%", "227,917,808"],
      ["Norges Bank", "1.31%", "190,726,866"]
    ],
    sec5FloatSummary: 'Float shares stand at 14.57B out of 14.59B total shares outstanding. Ongoing buybacks reduced the diluted share count by 2.27% YoY in FY2025 (diluted shares declining from 15.41B in FY2024 to 15.00B in FY2025). Short interest is minimal at 0.96% of float.',

    // Section 6: Valuation
    sec6Intro: 'Apple is trading near the upper end of its 5-year historical valuation ranges across most fundamental multiples.',
    sec6Headers: ["Multiple / Valuation Metric", "Current Reported Value", "Historical / Context Benchmark"],
    sec6Rows: [
      ["Trailing P/E", "38.17x (TTM P/E: 37.51x, Series P/E: 43.17x)", "5-Year Min: 18.62x / Median: 28.51x / Max: 43.45x"],
      ["Forward P/E", "34.58x", "Premium to broader technology sector"],
      ["PEG Ratio", "2.67x", "Indicates elevated price relative to growth rate"],
      ["Price / Book", "45.02x", "Influenced by low equity base from buybacks"],
      ["EV/Revenue", "10.41x", "Elevated for a hardware-heavy revenue mix"],
      ["EV/EBITDA", "28.92x", "High relative to FY2025 EBITDA of $144.75B"],
      ["Dividend Yield", "0.32%", "Payout ratio at 12.04%"]
    ],
    sec6Context: "Over the last 5 years, Apple's weekly P/E averaged 29.87x with a median of 28.51x. At ~38x to 43x P/E, current multiples sit at the upper percentile band, leaving limited cushion for valuation re-rating.",

    // Section 7: Projections
    sec7Intro: 'The following projections represent structured analytical scenarios based on reported financial trends and multiple assumptions, not financial promises or price targets.',
    sec7Assumptions: [
      'Base Diluted Share Count: ~14.65B shares (reflecting continuous ~2% annual buyback retirement).',
      'Reported Baseline TTM EPS: $8.83.',
      'Baseline Current Price: $331.34.'
    ],
    sec7Headers: ["Scenario", "Earnings Logic & Net Income", "Implied EPS (FY2026E)", "Target Valuation Multiple", "Implied Price Range", "Expected Stock Return"],
    sec7Rows: [
      ["Bear Case", "Hardware demand slowdown, Services margin deceleration.", "$8.53", "25.0x P/E (mean reversion)", "$213.25 - $230.00", "-35.6% to -30.6%"],
      ["Base Case", "Moderate Services growth, steady iPhone replacement cycle. Net Income: ~$135B", "$9.22", "34.0x P/E (forward consensus)", "$313.48 - $335.00", "-5.4% to +1.1%"],
      ["Bull Case", "Hardware acceleration, premium Services expansion. Net Income: ~$146B", "$9.97", "40.0x P/E (peak range)", "$398.80 - $410.00", "+20.4% to +23.7%"]
    ],
    sec7Separation: "Apple's operational business is projected to grow net earnings steadily by 5% to 13% across base/bull scenarios; however, stock returns are compressed by the starting valuation multiple (38x+), which creates an asymmetrical return profile unless peak multiples persist.",

    // Section 8: Growth Potential
    sec8Points: [
      { title: 'Services Growth Engine', desc: 'Services revenue continues to expand as a percentage of the total mix, benefiting from recurring digital subscriptions, App Store transactions, cloud storage, and fintech adoption (Apple Pay, Apple Card).' },
      { title: 'Hardware Replacement Cycles', desc: 'An installed base of over 2 billion active devices ensures a predictable upgrade cycle for iPhone, Mac, and Wearables.' },
      { title: 'Margin Expansion', desc: 'Corporate gross margins improved from 43.31% in FY2022 to 46.91% in FY2025, driven by higher services weighting and favorable component cost structures.' },
      { title: 'Per-Share Compounding', desc: 'Consistent deployment of free cash flow into share buybacks ($90.71B in FY2025) ensures EPS growth exceeds top-line revenue growth by 200-300 basis points annually.' }
    ],

    // Section 9: Key Risks
    sec9Risks: [
      { title: 'Valuation Multiple Compression', desc: 'With P/E multiples near 5-year highs (43.17x peak weekly series, 38.17x trailing), any broad market derating poses substantial downside risk to the stock price.' },
      { title: 'Receivables vs Revenue Divergence', desc: 'Forensic metrics highlight receivables growing faster than revenue (+12.63% divergence in FY2025; change in receivables -$7.03B), warranting close monitoring of working capital efficiency.' },
      { title: 'Consumer Spending & Product Reception', desc: 'Recent market commentary points to mixed hardware demand signals (e.g., reports regarding preorder pacing and competitive AI feature integrations).' },
      { title: 'Concentration in Hardware', desc: 'Despite Services growth, the majority of revenue and gross profit remains dependent on consumer hardware replacement velocity.' }
    ],

    // Section 10 & 11: Bullish vs Bearish Triggers
    sec10Triggers: [
      'Sustained double-digit top-line revenue acceleration across both hardware and services segments.',
      'Acceleration of operating margin past 34% driven by higher-margin digital platform monetization.',
      'Resolution of receivables divergence, bringing cash conversion back above 100% of net income.',
      'A healthy market valuation reset to the 28x-30x P/E historical median range, providing a more favorable entry risk/reward profile.'
    ],
    sec11Triggers: [
      'Multiple quarters of negative revenue or hardware shipment contraction.',
      'Severe gross margin compression below 44% caused by rising component or supply-chain input costs.',
      'Deceleration in share repurchase capacity due to cash flow contraction.',
      'Sustained multiple contraction toward the 5-year minimum (18.6x-22.0x P/E) in a higher-rate environment.'
    ],

    // Section 12: Technical Signals
    sec12Trend: 'Uptrend. The stock is in an established primary bull trend, supported by the Golden Cross configuration where the 50-day SMA ($318.70) remains positioned well above the 200-day SMA ($285.10), and the current price ($331.34) trades +16.22% above its 200-day moving average.',
    sec12Patterns: 'A Double Bottom near $307.01 was confirmed, signaling a completed base and bullish continuation toward recent highs.',
    sec12Indicators: [
      'MACD Bias: Bullish (MACD line: 4.3381, Signal line: 2.7512, Histogram: +1.5868).',
      'RSI State: Neutral to upper-momentum zone at 68.91, approaching overbought territory (>70).',
      'On-Balance Volume (OBV): Accumulation phase, reflecting net institutional buying volume on up days.',
      'Bollinger Bands Position: Current price ($331.34) trades at the 87.8% percentile of its band (Upper: $335.25, Mid: $319.27, Lower: $303.29), indicating upper-band compression.',
      'Moving Average Cross State: Golden Cross active.'
    ],
    sec12TraderView: 'Direction: Consolidation with an upward bias testing overhead resistance.',
    sec12Resistance: 'Immediate resistance at $333.08 (20-day high) and $339.79 (52-week high).',
    sec12Support: 'Immediate support at $319.27 (SMA 20/ BB Mid) followed by strong support at $305.59-$307.01 (20-day low / Double Bottom neckline).',
    sec12Tactical: 'Traders should watch for a decisive breakout above $335.25 on expanding volume or look for pullbacks toward the $318.70-$319.27 support band for favorable risk-defined long entries.',

    // Section 13: Final Judgement
    sec13Stances: [
      { profile: 'Existing Holders: HOLD.', advice: "Maintain existing core positions. Apple's cash generation, fortress balance sheet, and buyback support protect intrinsic value, though trimming overweight exposure near $335-$340 can be considered for portfolio rebalancing." },
      { profile: 'Fresh Investors: WAIT FOR PULLBACK.', advice: 'Avoid chasing shares near 5-year valuation highs (~38x P/E). Accumulate on pullbacks towards the $300-$315 range where risk/reward improves.' },
      { profile: 'Aggressive Investors / Momentum Traders: BUY ON BREAKOUT / TRADE RANGE.', advice: 'Trade long momentum targeting the 52-week high of $339.79 with a stop-loss anchored below the 20-day SMA ($319.27).' },
      { profile: 'Conservative Investors: UNDERWEIGHT / ACCUMULATE ON CORRECTIONS.', advice: 'Seek a broader margin of safety; allocate new capital only when forward multiples compress toward historical medians (28x P/E or below ~$260-$280).' }
    ],
    sec13Conclusion: 'Apple Inc. is an elite corporate compounder currently priced at premium valuation multiples that limit forward upside over the projected 2026 horizon. While operational health remains pristine, the stock offers a balanced to slightly unfavorable risk/reward for new capital at $331.34, justifying a disciplined Hold stance.'
  },

  'RELIANCE': {
    name: 'Reliance Industries Ltd',
    symbol: 'RELIANCE',
    subtitle: '2026 Investment View',
    analysisDoc: 'Analysis: RELIANCE.pdf',
    judgementTag: 'High-Quality Hold / Valuation-Constrained Accumulate',
    judgementText: `Reliance Industries Limited remains India's premier multi-sector conglomerate with leading market share in Oil-to-Chemicals (O2C), telecom (Jio), and organized retail, though current multiples price in aggressive execution timelines.`,
    executiveSummary: [
      { label: 'Business outlook', text: 'Steady cash generation from downstream refining and petchem provides robust capital backing while Jio ARPU hikes and retail network expansion compound high-margin retail consumer touchpoints.' },
      { label: 'Stock valuation', text: 'Trading at 28.5x trailing P/E and 2.1x P/B, representing a healthy premium over historical domestic energy multiples owing to digital and consumer platform re-rating.' },
      { label: 'Risk-adjusted view', text: 'Near-term upside is capped by heavy green-energy capex commitments and global refining margin volatility, balanced by dominant telecom ARPU growth and fortress domestic market leadership.' },
    ],
    summaryNote: 'With pristine balance sheet liquidity and integrated cash generation across three core pillars, Reliance offers steady compounding, though investors should stagger accumulation around technical support bands.',

    // Section 1
    sec1Intro: "Reliance Industries Limited operates across three pillars: Oil-to-Chemicals (O2C refining & petrochemicals), Digital Services (Jio Infocomm with 490M+ subscribers), and Organized Retail (Reliance Retail with 18,000+ stores nationwide).",
    sec1Bullets: [
      { title: 'Moat & Ecosystem Stickiness', desc: 'Jio platform locks in over 490 million subscribers with 5G rollout supremacy, while Reliance Retail enjoys unbeatable omnichannel distribution and deep supply-chain integration across Tier 1-4 Indian cities.' },
      { title: 'Capital Efficiency', desc: 'Posting Return on Capital Employed (ROCE) of 12.8% and ROE of 14.2%, with an ambitious ₹75,000 Cr green energy transition pipeline covering solar PV, green hydrogen, and battery gigafactories.' }
    ],
    sec1Outro: 'Positioned in the Conglomerate / Energy & Consumer sector on NSE/BSE, Reliance continues to hold the heaviest weighting in the benchmark NIFTY 50 and SENSEX indices.',

    // Section 2
    sec2Intro: "Historical financial statements reflect robust revenue scaling and steady cash flow generation across retail, telecom, and oil segments.",
    sec2Headers: ["Financial Metric", "FY2022", "FY2023", "FY2024", "FY2025", "TTM/Most Recent"],
    sec2Rows: [
      ["Total Revenue (₹ L Cr)", "₹7.21", "₹8.15", "₹9.12", "₹9.74", "₹9.98 (TTM)"],
      ["Gross Profit (₹ L Cr)", "₹1.85", "₹2.12", "₹2.45", "₹2.68", "₹2.75 (TTM)"],
      ["Gross Margin (%)", "25.7%", "26.0%", "26.9%", "27.5%", "27.6%"],
      ["Operating Income (₹ L Cr)", "₹1.12", "₹1.35", "₹1.58", "₹1.78", "₹1.82 (TTM)"],
      ["Operating Margin (%)", "15.5%", "16.6%", "17.3%", "18.3%", "18.2%"],
      ["Net Income (₹ Cr)", "₹58,400", "₹66,700", "₹71,200", "₹73,670", "₹76,400"],
      ["Diluted EPS (₹)", "₹86.2", "₹98.4", "₹105.1", "₹108.9", "₹112.8"],
      ["Operating Cash Flow (₹ Cr)", "₹1,10,200", "₹1,18,500", "₹1,26,400", "₹1,32,100", "₹1,38,500"],
      ["Free Cash Flow (₹ Cr)", "₹45,200", "₹52,100", "₹61,800", "₹58,900", "₹62,400"]
    ],
    sec2Bullets: [
      { title: 'Earnings & Revenue Trends', desc: 'FY2025 annual revenue reached ₹9.74 L Cr (+6.8% YoY) with consolidated TTM net profit crossing ₹76,400 Cr driven by double-digit Retail and Jio EBITDA growth.' },
      { title: 'Cash Conversion Quality', desc: 'Operating cash flow to net income remains robust at >175%, with consistent cash flow reinvestment into retail infrastructure, 5G spectrum, and new energy assets.' }
    ],

    // Section 3
    sec3Intro: 'Reliance maintains a conservative capital structure with net debt kept under control through strategic partner equity stakes and strong operating cash flows.',
    sec3Headers: ["Balance Sheet Metric", "FY2022", "FY2023", "FY2024", "FY2025"],
    sec3Rows: [
      ["Cash & Equivalents (₹ L Cr)", "₹1.24", "₹1.42", "₹1.68", "₹1.82"],
      ["Total Debt (₹ L Cr)", "₹3.12", "₹3.18", "₹3.25", "₹3.34"],
      ["Net Debt (₹ L Cr)", "₹1.88", "₹1.76", "₹1.57", "₹1.52"],
      ["Stockholders' Equity (₹ L Cr)", "₹7.45", "₹8.12", "₹8.85", "₹9.62"],
      ["Working Capital (₹ Cr)", "₹12,400", "₹15,200", "₹18,900", "₹21,400"],
      ["Current Ratio", "1.18x", "1.22x", "1.25x", "1.28x"],
      ["Debt-to-Equity", "0.42x", "0.39x", "0.37x", "0.35x"]
    ],
    sec3Bullets: [
      { title: 'Solvency & Liquidity', desc: 'Debt-to-Equity of 0.35x is extremely conservative for an industrial conglomerate of this magnitude, with cash reserves of ₹1.82 L Cr ensuring ample liquidity.' },
      { title: 'Capex Execution', desc: 'Capital investments in Jamnagar new energy giga-complex and 5G network rollout are self-funded via annual operating cash flows exceeding ₹1.3 L Cr.' },
      { title: 'Working Capital Health', desc: 'Disciplined receivables management and negative cash conversion cycle in retail optimize short-term liquidity.' }
    ],

    // Section 4
    sec4OrderBookDesc: 'Retail footfalls and telecom subscription churn/recharge metrics serve as real-time proxies for demand velocity rather than traditional multi-year contract backlogs.',
    sec4VisibilityDesc: 'High revenue visibility underpinned by monthly telecom prepaid/postpaid ARPU collections from 490M+ users and daily cash retail transactions across grocery, electronics, and fashion.',
    sec4MonitoringPoints: [
      'Jio monthly subscriber additions, 5G data consumption per user, and ARPU progression toward ₹220+.',
      'Retail square-footage additions, footfall density, and margin expansion in private labels.',
      'Singapore Gross Refining Margins (GRM) benchmark differentials and petrochemical spreads.'
    ],

    // Section 5
    sec5Intro: "Reliance's shareholder registry features strong promoter alignment alongside top domestic institutional and global sovereign wealth fund investors.",
    sec5Headers: ["Shareholder Category / Top Holders", "Ownership Percentage", "Shares Held"],
    sec5Rows: [
      ["Promoter & Promoter Group", "50.32%", "3,404,210,000"],
      ["Foreign Portfolio Investors (FPI)", "21.84%", "1,477,800,000"],
      ["Domestic Mutual Funds", "8.92%", "603,500,000"],
      ["Insurance Companies (LIC & others)", "7.15%", "483,800,000"],
      ["Retail & Individual Investors", "11.77%", "796,400,000"]
    ],
    sec5FloatSummary: 'Total shares outstanding stand at ~6.77B with promoter holding stable above 50%. Institutional holdings account for nearly 38% of equity with negligible pledged shares.',

    // Section 6
    sec6Intro: 'Reliance trades at a fair-to-premium valuation reflecting the sum-of-the-parts (SOTP) contribution of its consumer facing unicorns.',
    sec6Headers: ["Multiple / Valuation Metric", "Current Reported Value", "Historical / Context Benchmark"],
    sec6Rows: [
      ["Trailing P/E", "28.5x", "5-Year Min: 18.2x / Median: 24.5x / Max: 33.1x"],
      ["Price / Book", "2.1x", "5-Year Median: 1.9x"],
      ["EV/EBITDA", "14.2x", "Blended SOTP target multiple: 13.5x - 15.0x"],
      ["ROE (%)", "14.2%", "Benchmark Conglomerate Median: 11.8%"],
      ["ROCE (%)", "12.8%", "Benchmark Conglomerate Median: 10.5%"],
      ["Dividend Yield", "0.36%", "Focus on capital reinvestment & growth capex"]
    ],
    sec6Context: 'At 28.5x P/E, Reliance sits modestly above historical medians as the market discounts the eventual independent IPO value unlocking of Jio Platforms and Reliance Retail.',

    // Section 7
    sec7Intro: 'Structured analytical scenarios based on reported financial trends and multiple assumptions across oil, telecom, and retail segments.',
    sec7Assumptions: [
      'Diluted Share Count: ~6.77B shares.',
      'Baseline Reported TTM EPS: ₹112.80.',
      'Baseline Current Price: ₹2,745.30.'
    ],
    sec7Headers: ["Scenario", "Earnings Logic & Catalyst", "Implied EPS (FY2026E)", "Target Valuation Multiple", "Implied Price Range", "Expected Stock Return"],
    sec7Rows: [
      ["Bear Case", "Global recession dampening refining margins and slowdown in rural retail spending.", "₹108.50", "21.5x P/E", "₹2,250 - ₹2,350", "-18.0% to -14.4%"],
      ["Base Case", "Steady telecom ARPU increases to ₹215+ and 15% Retail EBITDA growth. Net profit: ~₹85,000 Cr", "₹125.50", "26.0x P/E", "₹2,850 - ₹3,050", "+3.8% to +11.1%"],
      ["Bull Case", "Fast green energy commissioning and value unlocking via Jio/Retail IPO filings. Net profit: ~₹96,000 Cr", "₹141.80", "30.0x P/E", "₹3,200 - ₹3,450", "+16.6% to +25.7%"]
    ],
    sec7Separation: "Reliance's diversified operational engine delivers stable 10-15% earnings compounding, though multiple expansion requires concrete timelines for subsidiary listings or green energy commercialization.",

    // Section 8
    sec8Points: [
      { title: 'Telecom Monetization (Jio)', desc: 'Transition from market-share acquisition to monetization via tariff hikes, 5G AirFiber fixed broadband expansion, and enterprise cloud solutions.' },
      { title: 'Retail Footprint & Omnichannel Scale', desc: 'Rapid rollout of smart retail stores, dark stores for quick commerce, and high-margin private label penetration across consumer electronics and FMCG.' },
      { title: 'Green Energy Super-Complex', desc: 'Jamnagar mega-scale solar PV manufacturing, advanced battery energy storage systems (BESS), and green hydrogen electrolyzers creating a multi-decade decarbonization cash generator.' },
      { title: 'Downstream Chemical Upgrading', desc: 'Maximizing chemical integration to convert crude directly into high-value specialty chemicals, mitigating long-term fossil fuel demand transition.' }
    ],

    // Section 9
    sec9Risks: [
      { title: 'Refining Margin Volatility (GRM)', desc: 'Cyclical swings in global product cracks (diesel, gasoline, ATF) and unexpected crude supply disruptions impact O2C earnings.' },
      { title: 'Capex Execution & Payback Timelines', desc: 'Multi-billion dollar capital expenditure in green energy carries technology obsolescence and gestation risks before reaching peak utilization.' },
      { title: 'Consumer Spending Headwinds', desc: 'Inflationary pressure impacting discretionary consumer basket size in fashion and lifestyle retail.' },
      { title: 'Regulatory & Tariff Scrutiny', desc: 'Telecom spectrum pricing policies and potential domestic windfall taxation on energy exports during geopolitical spikes.' }
    ],

    // Section 10 & 11
    sec10Triggers: [
      'Formal DRHP filing and IPO timeline announcement for Jio Platforms or Reliance Retail.',
      'Sequential GRM expansion above $12/bbl with stable crude feedstock supply.',
      'Faster-than-expected commercial commissioning of Jamnagar solar and battery gigafactories.',
      'Sustained Jio ARPU acceleration above ₹225 per subscriber.'
    ],
    sec11Triggers: [
      'Singapore GRM dipping below $5/bbl for consecutive quarters.',
      'Heavy competitive pricing resurgence in organized retail impacting EBITDA margins.',
      'Significant escalation in net debt without commensurate EBITDA growth.',
      'Delay in green hydrogen cost parity targets.'
    ],

    // Section 12
    sec12Trend: 'Bullish Uptrend. Primary trend is positive with the 50-day SMA (₹2,680) comfortably higher than the 200-day SMA (₹2,520), indicating strong institutional demand on dips.',
    sec12Patterns: 'Ascending triangle consolidation breaking out above the ₹2,720 pivot, confirming continued momentum towards ₹2,850.',
    sec12Indicators: [
      'MACD Bias: Bullish crossover on daily and weekly timeframes.',
      'RSI State: 62.0 — constructive momentum with room before entering overbought zone (>70).',
      'Volume Profile: Above-average delivery volume recorded on accumulation days.',
      'Moving Average State: Trading +8.9% above 200-day moving average.'
    ],
    sec12TraderView: 'Direction: Upward continuation targeting overhead resistance with well-defined trailing support.',
    sec12Resistance: 'Immediate resistance at ₹2,780 followed by major swing high resistance at ₹2,850.',
    sec12Support: 'Primary support at ₹2,680 (50-day SMA), secondary demand cluster at ₹2,580.',
    sec12Tactical: 'Accumulate in the ₹2,680 - ₹2,720 zone with stop-loss below ₹2,560, targeting tactical breakout toward ₹2,850 - ₹2,920.',

    // Section 13
    sec13Stances: [
      { profile: 'Existing Long-Term Holders: HOLD & ACCUMULATE.', advice: 'Maintain existing core allocation. Consumer platform dominance and green energy upside offer multi-year compounding safety.' },
      { profile: 'Fresh Investors: STAGGERED BUY ON DIPS.', advice: 'Deploy capital in tranches around the ₹2,650 - ₹2,720 support band to capture favorable risk-adjusted returns ahead of subsidiary value unlocking.' },
      { profile: 'Momentum / Swing Traders: BUY ON BREAKOUT.', advice: 'Trade long momentum upon clear daily closes above ₹2,750, targeting ₹2,850 with a tight stop-loss below ₹2,690.' },
      { profile: 'Conservative Value Investors: ALLOCATE CORE WEIGHT.', advice: 'Excellent defensive-growth asset for long-term equity portfolios given market capitalization and diversified domestic revenue.' }
    ],
    sec13Conclusion: 'Reliance Industries Ltd remains an indispensable core holding for domestic equity portfolios. With steady earnings visibility across telecom, retail, and energy, it justifies a confident Hold / Systematic Accumulate stance at ₹2,745.'
  }
}

const defaultAssetKey = 'AAPL'

export function AnalysisPage() {
  const { asset } = useParams<{ asset?: string }>()
  const selectedKey = asset?.toUpperCase() || defaultAssetKey
  const report = reportDatasets[selectedKey] || reportDatasets['AAPL']

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: `Hello. I am A.R.I.A. How can I assist you with this ${report.symbol} investment report today?` }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const leftColRef = useRef<HTMLDivElement>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const isSeeking = useRef(false)
  const targetTime = useRef(0)

  // Mouse tracking mapped to video timeline
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!videoRef.current || isNaN(videoRef.current.duration)) return
      if (isChatOpen) return

      const xPercentage = e.clientX / window.innerWidth
      targetTime.current = Math.max(0, Math.min(videoRef.current.duration, xPercentage * videoRef.current.duration))

      if (!isSeeking.current) {
        isSeeking.current = true
        videoRef.current.currentTime = targetTime.current
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isChatOpen])

  // Scrub when chat opens
  useEffect(() => {
    if (!videoRef.current || isNaN(videoRef.current.duration)) return

    if (isChatOpen) {
      targetTime.current = videoRef.current.duration * 0.85
      if (!isSeeking.current) {
        isSeeking.current = true
        videoRef.current.currentTime = targetTime.current
      }
    }
  }, [isChatOpen])

  const handleSeeked = () => {
    if (!videoRef.current) return
    if (Math.abs(videoRef.current.currentTime - targetTime.current) > 0.05) {
      videoRef.current.currentTime = targetTime.current
    } else {
      isSeeking.current = false
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setIsTyping(true)

    // Dynamic contextual responses
    await new Promise(resolve => setTimeout(resolve, 800))
    const responses = [
      `Regarding ${report.symbol}: The company is classified as a ${report.judgementTag}. Current valuation is trading near historical upper percentiles.`,
      `Key metrics for ${report.symbol}: Trailing P/E is ${report.sec6Rows?.[0]?.[1] || 'elevated'}, and our base case scenario targets ${report.sec7Rows?.[1]?.[4] || 'steady expansion'}.`,
      `Technical summary: ${report.sec12Trend}`,
      `Risk factors to monitor: ${report.sec9Risks?.[0]?.title} and ${report.sec9Risks?.[1]?.title}.`
    ]
    const chosen = responses[Math.floor(Math.random() * responses.length)]
    setChatMessages(prev => [...prev, { role: 'model', text: chosen }])
    setIsTyping(false)
  }

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, isTyping])

  // leftColRef kept for potential future use; window.scroll fires naturally since
  // the left column is part of normal page flow (no overflow-y-auto container).

  return (
    <div className="relative bg-black text-white w-full font-body selection:bg-white/30 selection:text-white">
      {/* Background Interactive AI Video */}
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_041744_63efcd78-bf7d-4039-99e2-2461e8a61903.mp4"
        className="fixed inset-0 z-0 object-cover w-full h-full pointer-events-none"
        style={{
          objectPosition: '85% center',
          transformOrigin: '80% 50%',
          transform: isChatOpen ? 'scale(0.95) translate(-2%, 6%)' : 'scale(0.85) translate(0%, 0%)',
          transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
        muted
        playsInline
        preload="auto"
        onSeeked={handleSeeked}
      />

      {/* Custom Scrollbar Styling */}
      <style>{`
        .custom-report-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-report-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-report-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-report-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {/* Two-Column layout — left col is normal page flow, right col is sticky to viewport */}
      <div className="relative z-10 flex flex-col md:flex-row w-full">

        {/* Left Column — scrolls with the page (no overflow-y-auto; window scroll fires naturally) */}
        {/* pb-[48px] clears the fixed footer */}
        <div
          ref={leftColRef}
          className="order-2 md:order-1 w-full md:w-[60%] lg:w-[55%] pointer-events-auto bg-black/60 md:bg-black/40 backdrop-blur-xl border-t md:border-t-0 md:border-r border-white/10 pt-6 pb-[48px] px-6 sm:px-10 md:px-16 custom-report-scrollbar shadow-2xl"
        >
          <div className="max-w-4xl mx-auto">

            {/* File Reference Badge + View Previous Reports — same row */}
            <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 border border-white/20 backdrop-blur-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span className="text-xs font-heading tracking-wider text-white/90 uppercase">{report.analysisDoc}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1"></span>
              </div>

              {/* View Previous Reports — premium button */}
              <Link
                to="/compare"
                className="relative flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold overflow-hidden group transition-all duration-300 hover:-translate-y-px shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(129,140,248,0.12) 100%)',
                  border: '1px solid rgba(56,189,248,0.28)',
                  color: '#bae6fd',
                  boxShadow: '0 0 18px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(129,140,248,0.22) 100%)' }} />
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
                  style={{ background: 'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.1) 50%,transparent 65%)' }} />
                <span className="absolute inset-x-2 top-0 h-px pointer-events-none"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(56,189,248,0.7),rgba(168,148,255,0.5),transparent)' }} />
                <svg className="relative z-10 w-3.5 h-3.5 text-[#38bdf8] group-hover:text-white transition-colors duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span className="relative z-10 tracking-wide group-hover:text-white transition-colors duration-200">View Previous Reports</span>
              </Link>
            </div>

            {/* Title Header */}
            <h1 className="text-4xl md:text-5xl font-heading mb-8 leading-tight text-white tracking-tight">
              {report.name} ({report.symbol}): <br className="hidden sm:block" />{report.subtitle}
            </h1>

            {/* Judgement Banner */}
            <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 mb-12 shadow-lg backdrop-blur-md">
              <h3 className="text-sm uppercase tracking-widest text-white/50 mb-3 font-heading font-medium">My Judgement</h3>
              <p className="text-lg md:text-xl text-white/90 leading-relaxed font-light">
                {report.judgementText} <br /><br />
                I would classify it as a <strong className="font-heading font-medium text-white px-2 py-1 bg-white/20 rounded-md ml-1 mr-1">{report.judgementTag}</strong>.
              </p>
            </div>

            {/* Executive Summary */}
            <div className="space-y-6 text-white/70 font-light leading-relaxed mb-12 text-[15px] sm:text-[17px]">
              {report.executiveSummary.map((item: any, idx: number) => (
                <p key={idx}>
                  <strong className="text-white font-medium font-heading">{item.label}:</strong> {item.text}
                </p>
              ))}
              <p>{report.summaryNote}</p>
            </div>

            {/* 1. Business Quality and Sector Positioning */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">1. Business Quality and Sector Positioning</h2>
              <p className="text-white/70 font-light leading-relaxed mb-5">{report.sec1Intro}</p>
              <ul className="list-disc pl-5 space-y-3 text-white/70 font-light mb-5">
                {report.sec1Bullets.map((b: any, idx: number) => (
                  <li key={idx}>
                    <strong className="text-white/90 font-medium">{b.title}:</strong> {b.desc}
                  </li>
                ))}
              </ul>
              <p className="text-white/70 font-light leading-relaxed">
                <strong className="text-white/90 font-medium">Sector Positioning:</strong> {report.sec1Outro}
              </p>
            </section>

            {/* 2. Financial Performance */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">2. Financial Performance</h2>
              <p className="text-white/70 font-light leading-relaxed mb-6">{report.sec2Intro}</p>

              <ReportTable
                headers={report.sec2Headers}
                rows={report.sec2Rows}
              />

              <ul className="list-disc pl-5 space-y-3 text-white/70 font-light mt-6">
                {report.sec2Bullets.map((b: any, idx: number) => (
                  <li key={idx}>
                    <strong className="text-white/90 font-medium">{b.title}:</strong> {b.desc}
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. Balance-Sheet Analysis */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">3. Balance-Sheet Analysis</h2>
              <p className="text-white/70 font-light leading-relaxed mb-6">{report.sec3Intro}</p>

              <ReportTable
                headers={report.sec3Headers}
                rows={report.sec3Rows}
              />

              <ul className="list-disc pl-5 space-y-3 text-white/70 font-light mt-6">
                {report.sec3Bullets.map((b: any, idx: number) => (
                  <li key={idx}>
                    <strong className="text-white/90 font-medium">{b.title}:</strong> {b.desc}
                  </li>
                ))}
              </ul>
            </section>

            {/* 4. Order Book and Revenue Visibility */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">4. Order Book and Revenue Visibility</h2>
              <div className="space-y-4 text-white/70 font-light leading-relaxed">
                <p><strong className="text-white/90 font-medium">Order Book Disclosures:</strong> {report.sec4OrderBookDesc}</p>
                <p><strong className="text-white/90 font-medium">Revenue Visibility Factors:</strong> {report.sec4VisibilityDesc}</p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                  {report.sec4MonitoringPoints.map((pt: string, idx: number) => (
                    <li key={idx}><strong className="text-white/90 font-medium">Monitoring Point:</strong> {pt}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 5. Shareholding Pattern */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">5. Shareholding Pattern</h2>
              <p className="text-white/70 font-light leading-relaxed mb-6">{report.sec5Intro}</p>

              <ReportTable
                headers={report.sec5Headers}
                rows={report.sec5Rows}
              />

              <p className="text-white/70 font-light leading-relaxed mt-6">
                <strong className="text-white/90 font-medium">Total Float & Dilution Dynamics:</strong> {report.sec5FloatSummary}
              </p>
            </section>

            {/* 6. Valuation */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">6. Valuation</h2>
              <p className="text-white/70 font-light leading-relaxed mb-6">{report.sec6Intro}</p>

              <ReportTable
                headers={report.sec6Headers}
                rows={report.sec6Rows}
              />

              <p className="text-white/70 font-light leading-relaxed mt-6">
                <strong className="text-white/90 font-medium">Historical Multiples Context:</strong> {report.sec6Context}
              </p>
            </section>

            {/* 7. Projections */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">7. My End-2026 Projection</h2>
              <p className="text-white/70 font-light leading-relaxed mb-4">{report.sec7Intro}</p>
              <ul className="list-disc pl-5 space-y-2 text-white/70 font-light mb-6">
                <li><strong className="text-white/90 font-medium">Core Assumptions:</strong></li>
                <ul className="list-[circle] pl-5 space-y-1 mt-1">
                  {report.sec7Assumptions.map((asm: string, idx: number) => (
                    <li key={idx}>{asm}</li>
                  ))}
                </ul>
              </ul>

              <ReportTable
                headers={report.sec7Headers}
                rows={report.sec7Rows}
              />

              <p className="text-white/70 font-light leading-relaxed mt-6">
                <strong className="text-white/90 font-medium">Business Potential vs Stock Return Separation:</strong> {report.sec7Separation}
              </p>
            </section>

            {/* 8. Growth Potential */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">8. Does the Company Still Have Potential to Grow?</h2>
              <ul className="list-disc pl-5 space-y-3 text-white/70 font-light">
                {report.sec8Points.map((pt: any, idx: number) => (
                  <li key={idx}><strong className="text-white/90 font-medium">{pt.title}:</strong> {pt.desc}</li>
                ))}
              </ul>
            </section>

            {/* 9, 10, 11. Key Risks and Bullish / Bearish triggers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-14">
              <div>
                <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">9. Key Risks</h2>
                <ul className="list-disc pl-5 space-y-3 text-white/70 font-light">
                  {report.sec9Risks.map((r: any, idx: number) => (
                    <li key={idx}><strong className="text-white/90 font-medium">{r.title}:</strong> {r.desc}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-10">
                <div>
                  <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">10. What Would Make Me More Bullish?</h2>
                  <ul className="list-disc pl-5 space-y-2 text-white/70 font-light">
                    {report.sec10Triggers.map((t: string, idx: number) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">11. What Would Make Me Bearish?</h2>
                  <ul className="list-disc pl-5 space-y-2 text-white/70 font-light">
                    {report.sec11Triggers.map((t: string, idx: number) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 12. Technical Trading Signals */}
            <section className="mb-14">
              <h2 className="text-2xl font-heading text-white border-b border-white/20 pb-3 mb-6">12. Technical Trading Signals</h2>
              <ul className="list-disc pl-5 space-y-3 text-white/70 font-light mb-4">
                <li><strong className="text-white/90 font-medium">Overall Trend:</strong> {report.sec12Trend}</li>
                <li><strong className="text-white/90 font-medium">Detected Patterns:</strong> {report.sec12Patterns}</li>
                <li><strong className="text-white/90 font-medium">Technical Indicators Summary:</strong></li>
                <ul className="list-[circle] pl-5 space-y-1 mt-1">
                  {report.sec12Indicators.map((ind: string, idx: number) => (
                    <li key={idx}>{ind}</li>
                  ))}
                </ul>
                <li><strong className="text-white/90 font-medium">Near-Term Trader's View:</strong> {report.sec12TraderView}</li>
                <li><strong className="text-white/90 font-medium">Key Resistance Levels:</strong> {report.sec12Resistance}</li>
                <li><strong className="text-white/90 font-medium">Key Support Levels:</strong> {report.sec12Support}</li>
              </ul>
              <p className="text-white/70 font-light leading-relaxed">
                <strong className="text-white/90 font-medium">Tactical Action:</strong> {report.sec12Tactical}
              </p>
            </section>

            {/* 13. Final Investment Judgement */}
            <section className="mb-14 p-8 rounded-2xl border border-white/20 bg-gradient-to-b from-white/10 to-transparent">
              <h2 className="text-3xl font-heading text-white pb-6 mb-6 border-b border-white/20">13. Final Investment Judgement</h2>

              <h3 className="text-xl font-heading text-white mb-4">Stances by Investor Profile</h3>
              <ul className="space-y-4 mb-8">
                {report.sec13Stances.map((s: any, idx: number) => (
                  <li key={idx} className="text-white/70 font-light">
                    <strong className="text-white/90 font-heading">{s.profile}</strong> {s.advice}
                  </li>
                ))}
              </ul>

              <h3 className="text-xl font-heading text-white mb-4">Best Overall Judgement</h3>
              <p className="text-white/90 font-light leading-relaxed text-lg">
                {report.sec13Conclusion}
              </p>
            </section>

            {/* Disclaimer */}
            <p className="text-white/40 text-xs text-center border-t border-white/10 pt-6 mt-12 pb-10 uppercase tracking-widest font-heading">
              Disclaimer: This analysis is for educational and informational purposes only based strictly on supplied historical and market data. It does not constitute financial, investment, or trading advice. Generated by StocksAgent - {report.symbol}. Page 7 of 7.
            </p>

          </div>
        </div>

        {/* Right Column — sticky to viewport so it stays in place while left col scrolls */}
        <div className="hidden md:block order-1 md:order-2 md:w-[40%] lg:w-[45%] pointer-events-none shrink-0 md:sticky md:top-0 md:h-[calc(100vh-60px)]" />

        {/* A.R.I.A Floating Chat — fixed; sits above the fixed footer (h-12 = 48px) */}
        <div className="fixed bottom-[64px] right-6 md:bottom-[68px] md:right-10 pointer-events-auto z-[400] flex flex-col items-end">

            {/* Chat Modal Window */}
            <div
              className={`w-[calc(100vw-3rem)] sm:w-[380px] h-[450px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
                isChatOpen
                  ? 'opacity-100 scale-100 translate-y-0 mb-4'
                  : 'opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-full mb-4'
              }`}
            >
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/20">
                    <span className="text-[15px] select-none text-white absolute">✳︎</span>
                    {isTyping && <div className="absolute inset-0 rounded-full border border-white/50 animate-ping opacity-20"></div>}
                  </div>
                  <div>
                    <h4 className="font-heading text-sm text-white/90">A.R.I.A</h4>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-heading">Financial Analyst</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-white/50 hover:text-white transition-colors p-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-4 custom-report-scrollbar flex flex-col"
              >
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-white text-black rounded-br-sm'
                          : 'bg-white/10 text-white/80 border border-white/5 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex w-full justify-start">
                    <div className="bg-white/10 border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-black/20">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask about the ${report.symbol} report...`}
                    className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-2.5 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Chat Trigger FAB */}
            <button
              onClick={() => setIsChatOpen(true)}
              className={`w-14 h-14 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:bg-white/20 hover:scale-110 transition-all duration-300 ${
                isChatOpen ? 'scale-0 opacity-0 pointer-events-none absolute' : 'scale-100 opacity-100'
              }`}
            >
              <span className="text-[28px] select-none mt-1">✳︎</span>
            </button>

        </div>

      </div>

      {/* ── Fixed full-width footer — always visible at bottom of viewport ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-[350] h-12 flex items-center border-t border-white/[0.08] bg-[rgba(1,3,8,0.85)] backdrop-blur-xl pointer-events-auto">
        <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-10 flex items-center justify-between gap-4">
          <span className="text-[11px] text-white/30">© 2026 NXTvue Systems, Inc. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <a href="#" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">Contact</a>
            <span className="text-[11px] text-white/20 hidden sm:inline">Secure Investment Intelligence Platform</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
