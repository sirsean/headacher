import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import NavigationBar from './components/NavigationBar'
import { AuthProvider } from './context/AuthContext'
import { MutationsProvider } from './context/MutationsContext'
import { NotificationProvider } from './context/NotificationContext'
import NotificationContainer from './components/NotificationContainer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MutationsProvider>
          <NotificationProvider>
            <NavigationBar />
            <Routes>
              {/* Mount App for all paths so nested routes inside App can match */}
              <Route path="/*" element={<App />} />
            </Routes>
            <NotificationContainer />
          </NotificationProvider>
        </MutationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
