import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './pages/pages.css'
import './pages/AnalysisBoardPage.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { SoundProvider } from './contexts/SoundContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { GameProvider } from './contexts/GameContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SoundProvider>
          <AuthProvider>
            <GameProvider>
              <App />
            </GameProvider>
          </AuthProvider>
        </SoundProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
