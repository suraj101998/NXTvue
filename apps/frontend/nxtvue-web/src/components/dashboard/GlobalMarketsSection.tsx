import { TvWidget } from '@/components/charts/TvWidget'

// Both widgets are TradingView web components. `autosize` fills the card, so each card needs a fixed height.
const CARD = 'rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden'

export function GlobalMarketsSection() {
  return (
    <section className="bg-[#F5F5F5] px-6 pb-24" id="global-markets" aria-labelledby="global-markets-title">
      <div className="max-w-[88rem] mx-auto">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-black/70 text-xs font-semibold uppercase tracking-wider mb-3">
            Global Markets
          </div>
          <h2
            id="global-markets-title"
            className="text-4xl md:text-5xl font-medium leading-none text-black tracking-tight mb-4"
            style={{ letterSpacing: '-0.04em' }}
          >
            The world at a glance
          </h2>
          <p className="text-black/70 text-base md:text-lg max-w-2xl leading-relaxed">
            See how each country&apos;s main index is moving, and how economies compare on GDP, inflation and more.
            Data may be delayed.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <article className={CARD} aria-label="World market summary">
            <h3 className="px-6 pt-5 pb-3 text-sm font-semibold uppercase tracking-wider text-black/70">
              World market summary
            </h3>
            <TvWidget
              widget="world-market-summary"
              theme="light"
              height={520}
              options={{ view: 'map', 'hover-type': 'performance-grid', sort: 'performance' }}
              // Country indices have no route in the app, so do not navigate away from the dashboard.
              onSymbolSelect={() => {}}
            />
          </article>

          <article className={CARD} aria-label="Economic map">
            <h3 className="px-6 pt-5 pb-3 text-sm font-semibold uppercase tracking-wider text-black/70">
              Economic map
            </h3>
            <TvWidget
              widget="economic-map"
              theme="light"
              height={520}
              options={{ region: 'global', metric: 'gdp' }}
              onSymbolSelect={() => {}}
            />
          </article>
        </div>
      </div>
    </section>
  )
}
