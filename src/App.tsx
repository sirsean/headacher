import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './HomePage'
import EntryPage from './EntryPage.jsx'
import HistoryPage from './HistoryPage.jsx'

function App() {
  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Routes>
        {/* Define child routes relative to the parent (mounted at /*) */}
        <Route index element={<HomePage />} />
        <Route path="entry" element={<EntryPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Routes>
    </div>
  )
}

export default App
