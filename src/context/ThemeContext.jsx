import { createContext, useContext, useEffect } from 'react'

// The site is dark-only for now. This provider is kept (rather than ripped out)
// so the components that branch on `theme` — WebGL backdrops picking colours,
// mostly — keep working, and so light mode can be restored by reinstating the
// state here without touching every consumer.
const ThemeContext = createContext({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    // Clear any light preference persisted before the site went dark-only.
    localStorage.removeItem('acm-theme')
  }, [])

  return <ThemeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
