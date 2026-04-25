// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { HomeConfigProvider } from './context/HomeConfigContext'
import { ThemeProvider } from './context/ThemeContext'
import { RotaProvider } from './context/RotaContext'
import './styles/globals.css'
import App from './App'
import './utils/icons'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <HomeConfigProvider>
          <RotaProvider>
            <App />
          </RotaProvider>
        </HomeConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
