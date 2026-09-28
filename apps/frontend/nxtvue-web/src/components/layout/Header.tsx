import { Navigation } from './Navigation'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-[300]" role="banner">
      <Navigation />
    </header>
  )
}
