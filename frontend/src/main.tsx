import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import './styles/tokens.css'
import App from './App'
import { ShellProvider } from './state/shell'

document.documentElement.classList.toggle('dark', localStorage.getItem('tryoutsim-theme') === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ShellProvider>
        <App />
      </ShellProvider>
    </BrowserRouter>
  </StrictMode>,
)
