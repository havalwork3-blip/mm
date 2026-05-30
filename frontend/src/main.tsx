import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './context/LocaleContext'
import { SessionProvider } from './context/SessionContext'
import { ThemeProvider } from './context/ThemeContext'
import { initOfflineAutoSync } from './lib/api'
import './index.css'
import App from './App'

initOfflineAutoSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <SessionProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </SessionProvider>
    </LocaleProvider>
  </StrictMode>,
)
