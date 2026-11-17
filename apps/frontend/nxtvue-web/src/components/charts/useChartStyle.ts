import { useCallback, useState } from 'react'

export type ChartStyle = 'line' | 'candle'

/** One choice for every price chart in the app (the charts page and the dashboard index pop-up). */
const KEY = 'nxtvue_chart_style'

function read(): ChartStyle {
  try {
    return localStorage.getItem(KEY) === 'candle' ? 'candle' : 'line'
  } catch {
    return 'line'
  }
}

export function useChartStyle() {
  const [style, setState] = useState<ChartStyle>(read)
  const setStyle = useCallback((next: ChartStyle) => {
    setState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private mode: the choice then lasts until the page is closed.
    }
  }, [])
  return [style, setStyle] as const
}
