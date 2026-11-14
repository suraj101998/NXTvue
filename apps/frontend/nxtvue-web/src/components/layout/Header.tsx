import { Navigation } from './Navigation'

/** The navbar, fixed to the top of every page. */
export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-[300]" role="banner">
      <Navigation />
      <span className="nx-hair" aria-hidden="true" />
    </header>
  )
}
