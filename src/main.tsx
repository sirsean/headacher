import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import NavigationBar from './components/NavigationBar'
import { MutationsProvider } from './context/MutationsContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MutationsProvider>
        <NavigationBar />
        <Routes>
          {/* Mount App for all paths so nested routes inside App can match */}
          <Route path="/*" element={<App />} />
        </Routes>
      </MutationsProvider>
    </BrowserRouter>
  </StrictMode>,
)
