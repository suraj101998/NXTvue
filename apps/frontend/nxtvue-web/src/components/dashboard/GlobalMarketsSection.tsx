import { TvWidget } from '@/components/charts/TvWidget'
import { useTheme } from '@/hooks/useTheme'
import { Reveal } from '@/components/motion/Reveal'

// Both widgets are TradingView web components. `autosize` fills the card, so each card needs a fixed height.
const CARD = 'dx-card dx-glass flush'

export function GlobalMarketsSection() {
  const { theme } = useTheme()
  return (
    <section className="bg-transparent px-6 pb-28" id="global-markets" aria-labelledby="global-markets-title">
      <div className="max-w-[88rem] mx-auto">
        <Reveal className="mb-12">
          <div className="dx-eyebrow"><i />Global Markets</div>
          <h2 id="global-markets-title" className="dx-h2">
            The world <em>at a glance</em>
          </h2>
          <p className="dx-lead !max-w-2xl">
            See how each country&apos;s main index is moving, and how economies compare on GDP, inflation and more.
            Data may be delayed.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Reveal as="article" className={CARD} aria-label="World market summary">
            <h3 className="dx-title px-7 pt-6 !mb-3">
              World market summary
            </h3>
            <TvWidget
              widget="world-market-summary"
              theme={theme}
              height={520}
              options={{ view: 'map', 'hover-type': 'performance-grid', sort: 'performance' }}
              // Country indices have no route in the app, so do not navigate away from the dashboard.
              onSymbolSelect={() => {}}
            />
          </Reveal>

          <Reveal as="article" delay={120} className={CARD} aria-label="Economic map">
            <h3 className="dx-title px-7 pt-6 !mb-3">
              Economic map
            </h3>
            <TvWidget
              widget="economic-map"
              theme={theme}
              height={520}
              options={{ region: 'global', metric: 'gdp' }}
              onSymbolSelect={() => {}}
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
