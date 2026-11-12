import { useMemo, type CSSProperties } from "react";
import type { IndiaFundamentals } from "@/api/india";
import type { UsFundamentals } from "@/api/desk";
import type { Polled } from "@/hooks/usePolled";
import { big, crore, dash } from "./chartFormat";

const st = (
  v: CSSProperties & Record<`--${string}`, string | number>,
): CSSProperties => v;

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div>
    <span className="lb">{k}</span>
    <b>{v}</b>
  </div>
);

function Loading({ p, what }: { p: Polled<unknown>; what: string }) {
  return (
    <div className="empty">
      {p.loading
        ? `Loading ${what}…`
        : `${what} unavailable${p.error ? `: ${p.error}` : ""}`}
    </div>
  );
}

export function UsFundamentalsPanels({ f }: { f: Polled<UsFundamentals> }) {
  const d = f.data;
  const r = d?.ratios;
  const cf = d?.cashFlow;
  const m = d?.margins;
  const money = (n: number | null | undefined) =>
    n == null ? "—" : `${n < 0 ? "−" : ""}${big(Math.abs(n))}`;
  const margins = m
    ? (
        [
          ["Gross margin", m.gross],
          ["Operating margin", m.operating],
          ["Net margin", m.net],
          ["Return on assets", m.returnOnAssets],
          ["Return on equity", m.returnOnEquity],
        ] as const
      ).filter(([, v]) => v != null)
    : [];
  // ETFs and funds have no operating company behind them: hide what the data source cannot fill.
  const showProfile = !d || !!(d.sector || d.industry || d.employees);
  const showFund =
    !d ||
    !!(cf && Object.values(cf).some((v) => v != null)) ||
    margins.length > 0;
  if (!d && !f.loading) return null;
  if (d && !showProfile && !showFund) return null;
  return (
    <section className="r2">
      {showProfile && (
        <div className="pn">
          <h3>Company profile</h3>
          {!d || !r ? (
            <Loading p={f} what="company profile" />
          ) : (
            <>
              <div className="sub">
                {[
                  d.sector,
                  d.industry,
                  d.employees
                    ? `${Math.round(d.employees / 1000)}K employees`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <p className="desc">
                {d.description}
                {d.headquarters ? ` Headquartered in ${d.headquarters}.` : ""}
              </p>
              <div className="st">
                <Stat k="Mkt cap" v={big(r.marketCap)} />
                <Stat k="EV" v={big(r.enterpriseValue)} />
                <Stat k="EV/EBITDA" v={dash(r.evToEbitda)} />
                <Stat k="P/E" v={dash(r.pe)} />
                <Stat k="P/S" v={dash(r.ps)} />
                <Stat k="P/B" v={dash(r.pb)} />
                <Stat k="P/CF" v={dash(r.priceToCashFlow)} />
                <Stat k="P/FCF" v={dash(r.priceToFreeCashFlow)} />
                <Stat k="Rev/share" v={dash(r.revenuePerShare)} />
              </div>
            </>
          )}
        </div>
      )}
      {showFund && (
        <div className="pn">
          <h3>Fundamental data</h3>
          {!d || !cf ? (
            <Loading p={f} what="fundamentals" />
          ) : (
            <>
              <div className="sub">
                FY end {d.fiscalYearEnd ?? "—"} · last period{" "}
                {d.lastPeriod ?? "—"}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Cash flow (TTM)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Total revenue", cf.totalRevenue],
                      ["Operating", cf.operating],
                      ["Investing", cf.investing],
                      ["Financing", cf.financing],
                      ["Free cash flow", cf.freeCashFlow],
                      ["CapEx", cf.capex],
                    ] as const
                  ).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td
                        className={
                          v == null
                            ? ""
                            : v < 0
                              ? "dn"
                              : k === "Free cash flow"
                                ? "up"
                                : ""
                        }
                      >
                        {money(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bars">
                {margins.map(([k, v]) => (
                  <div key={k} className="br">
                    <span>
                      {k}
                      <b>{(v as number).toFixed(2)}%</b>
                    </span>
                    <i
                      style={st({
                        width: `${Math.max(0, Math.min(100, v as number))}%`,
                      })}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function IndiaFundamentalsPanels({
  f,
}: {
  f: Polled<IndiaFundamentals>;
}) {
  const d = f.data;
  const r = d?.ratios;
  const qs = useMemo(() => d?.quarters ?? [], [d]);
  const num = (v: number | null | undefined) =>
    v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const qoq = (pick: (q: (typeof qs)[number]) => number | null) => {
    const a = qs.at(-1);
    const b = qs.at(-2);
    const x = a && pick(a);
    const y = b && pick(b);
    return x != null && y ? (x / y - 1) * 100 : null;
  };
  const rev = qoq((q) => q.revenue);
  const ni = qoq((q) => q.netIncome);
  const bar = (v: number | null) =>
    `${Math.max(4, Math.min(100, Math.abs(v ?? 0) * 3))}%`;
  // ETFs (MON100, NIFTYBEES...) have no company results: show only the panels that have data.
  if (!d && !f.loading) return null;
  const showQuarters = !d || qs.length > 0;
  return (
    <section className="r2">
      <div className="pn">
        {!d || !r ? (
          <>
            <h3>Company profile</h3>
            <Loading p={f} what="company profile" />
          </>
        ) : (
          <>
            <h3>{d.name ?? d.symbol}</h3>
            <div className="sub">
              {[
                d.isin ? `ISIN ${d.isin}` : null,
                d.sector,
                d.marketCapLabel,
                d.risk,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <p className="desc">{d.description}</p>
            <div className="st">
              <Stat k="Mkt cap" v={crore(r.marketCap)} />
              <Stat k="P/E" v={dash(r.pe)} />
              <Stat k="Industry P/E" v={dash(r.industryPe)} />
              <Stat k="P/B" v={dash(r.pb)} />
              <Stat k="EPS" v={r.eps == null ? "—" : `₹${r.eps.toFixed(2)}`} />
              <Stat k="ROE" v={dash(r.roe, 2, "%")} />
              <Stat k="Div. yield" v={dash(r.dividendYield, 2, "%")} />
              <Stat k="Beta" v={dash(r.beta)} />
              <Stat
                k="52W hi / lo"
                v={
                  r.high52w != null && r.low52w != null
                    ? `${num(r.high52w)} / ${num(r.low52w)}`
                    : "—"
                }
              />
            </div>
          </>
        )}
      </div>
      {showQuarters && (
        <div className="pn">
          <h3>Quarterly results</h3>
          {!d ? (
            <Loading p={f} what="quarterly results" />
          ) : (
            <>
              <div className="sub">Amounts in ₹ crore · Source: Tickertape</div>
              <table>
                <thead>
                  <tr>
                    <th>Quarter</th>
                    <th>Revenue</th>
                    <th>Op. profit</th>
                    <th>Net income</th>
                    <th>EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {qs.map((q) => (
                    <tr key={q.period}>
                      <td>{q.period}</td>
                      <td>{num(q.revenue)}</td>
                      <td>{num(q.operatingProfit)}</td>
                      <td>{num(q.netIncome)}</td>
                      <td>{num(q.eps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bars">
                {rev != null && (
                  <div className="br">
                    <span>
                      Revenue QoQ
                      <b
                        className={rev >= 0 ? "up" : "dn"}
                      >{`${rev >= 0 ? "+" : "−"}${Math.abs(rev).toFixed(1)}%`}</b>
                    </span>
                    <i style={{ width: bar(rev) }} />
                  </div>
                )}
                {ni != null && (
                  <div className="br">
                    <span>
                      Net income QoQ
                      <b
                        className={ni >= 0 ? "up" : "dn"}
                      >{`${ni >= 0 ? "+" : "−"}${Math.abs(ni).toFixed(1)}%`}</b>
                    </span>
                    <i style={{ width: bar(ni) }} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
