import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { RegistrationsProvider } from './context/RegistrationsContext'
import App from './App'
import './index.css'

const root = createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    {/* reducedMotion="user": with the OS "reduce motion" setting on, every
        Framer Motion animation drops its movement and keeps only fades. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <RegistrationsProvider>
                <App />
              </RegistrationsProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)

// Tell the intro loader (index.html) the app has mounted.
window.__acmStep?.()
