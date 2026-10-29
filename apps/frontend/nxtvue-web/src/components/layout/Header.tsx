import { Navigation } from './Navigation'
import { TvWidget } from '../charts/TvWidget'

interface HeaderProps {
  /** The live ticker tape is shown on the Charts page only. */
  showTicker?: boolean
}

export function Header({ showTicker = false }: HeaderProps) {
  return (
    <header className={`fixed top-0 left-0 right-0 z-[300] ${showTicker ? 'bg-[#f4f6fa]' : ''}`} role="banner">
      <Navigation />

      {showTicker && (
        <div className="w-full bg-white border-b border-slate-200 h-[72px] overflow-hidden shadow-sm">
          <TvWidget
            widget="ticker-tape"
            theme="light"
            height="72px"
            options={{
              symbols: 'FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FX_IDC:USDINR,OANDA:XAUUSD,TVC:USOIL,BITSTAMP:BTCUSD',
              transparent: true,
              'show-hover': true,
            }}
          />
        </div>
      )}
    </header>
  )
}
