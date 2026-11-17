import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'
import type { IndexQuote } from '@/hooks/useIndices'
import { useTheme } from '@/hooks/useTheme'
import { useChartStyle } from '@/components/charts/useChartStyle'
import { ChartPanel } from '@/pages/chart/ChartPanels'
import { TFS, type TF } from '@/pages/chart/chartMath'
import { currencySign, localeFor, makeFmt } from '@/pages/chart/chartFormat'
import { usePack } from '@/pages/chart/useChartData'
import type { Layers } from '@/pages/chart/chartSvg'
import '@/pages/chart/chart.css'

type Market = 'india' | 'us'

/** Price only: the pop-up shows no indicator layers. */
const NO_LAYERS: Layers = { ob: false, fvg: false, sr: false, s20: false, s50: false, s200: false, vol: false, rsi: false, macd: false }

/** Yahoo symbols for the cards, used when an older API response carries no `symbol`. */
const SYMBOL_BY_NAME: Record<string, string> = {
  'NIFTY 50': '^NSEI',
  SENSEX: '^BSESN',
  'NIFTY BANK': '^NSEBANK',
  'NIFTY IT': '^CNXIT',
  'NIFTY PHARMA': '^CNXPHARMA',
  'NIFTY AUTO': '^CNXAUTO',
  'NIFTY FMCG': '^CNXFMCG',
  'NIFTY METAL': '^CNXMETAL',
  'NIFTY ENERGY': '^CNXENERGY',
  'NIFTY INFRA': '^CNXINFRA',
  'NIFTY REALTY': '^CNXREALTY',
  'NIFTY MEDIA': '^CNXMEDIA',
  'S&P 500': '^GSPC',
  NASDAQ: '^IXIC',
  'DOW JONES': '^DJI',
  'RUSSELL 2000': '^RUT',
  'NASDAQ 100': '^NDX',
  VIX: '^VIX',
}

interface Props {
  index: IndexQuote
  market: Market
  onClose: () => void
}

/** Dashboard pop-up with an index chart. It is the same ChartPanel the charts page uses, minus the indicators. */
export function IndexChartModal({ index, market, onClose }: Props) {
  const { theme } = useTheme()
  const [tf, setTf] = useState<TF>('1D')
  const [chartStyle, setChartStyle] = useChartStyle()
  const symbol = index.symbol ?? SYMBOL_BY_NAME[index.name]

  const pack = usePack(symbol ? { symbol, market } : undefined, TFS[tf][0])

  const cur = market === 'india' ? 'INR' : 'USD'
  const fmt = useMemo(() => ({ cu: currencySign(cur), F: makeFmt(localeFor(cur)), loc: localeFor(cur) }), [cur])

  // Esc closes, and the page behind does not scroll while the card is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const status = !symbol
    ? `${index.name} has no chart data.`
    : pack.error
      ? `${index.name} chart is unavailable right now: ${pack.error}`
      : 'Loading candles…'

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${index.name} chart`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[94vh] w-full max-w-[850px] flex-col min-[1056px]:mr-[174px] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0e1330]">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-black/60 transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to dashboard
            </button>
            <h3 className="text-lg font-semibold text-black dark:text-white">{index.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart"
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="nxc nxc-embed overflow-y-auto" data-theme={theme}>
          <ChartPanel
            view={pack.data}
            tf={tf}
            onTf={setTf}
            layers={NO_LAYERS}
            chartStyle={chartStyle}
            onChartStyle={setChartStyle}
            headline={{ price: index.value, change: index.change, changePct: index.changePct }}
            title={null}
            hi={null}
            lo={null}
            fmt={fmt}
            status={status}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
