import { Route, Routes } from 'react-router-dom'
import HomePage from './HomePage'
import DashboardPage from './DashboardPage'
import EntryPage from './EntryPage.jsx'
import HistoryPage from './HistoryPage.jsx'

function App() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
      <Routes>
        {/* Define child routes relative to the parent (mounted at /*) */}
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="entry" element={<EntryPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Routes>
    </div>
  )
}

export default App
