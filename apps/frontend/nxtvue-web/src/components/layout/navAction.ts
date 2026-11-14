import { createContext, useContext, useEffect } from 'react'

/** The main button in the navbar. It reads "See Plans" unless the page asks for something else. */
export interface NavAction {
  label: string
  /** In-page anchor such as `#verdict`. */
  href: string
}

interface NavActionState {
  action: NavAction | null
  setAction: (a: NavAction | null) => void
}

export const NavActionContext = createContext<NavActionState>({ action: null, setAction: () => {} })

export function useNavActionValue(): NavAction | null {
  return useContext(NavActionContext).action
}

/** Replace the navbar's "See Plans" button while this page is open. Pass null to keep "See Plans". */
export function useNavAction(action: NavAction | null) {
  const { setAction } = useContext(NavActionContext)
  const label = action?.label
  const href = action?.href
  useEffect(() => {
    setAction(label && href ? { label, href } : null)
    return () => setAction(null)
  }, [label, href, setAction])
}
