import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Scoring from './pages/Scoring'
import Viewer from './pages/Viewer'
import AdminGate from './components/AdminGate'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/admin/:matchId"
          element={
            <AdminGate>
              <Scoring />
            </AdminGate>
          }
        />
        <Route path="/match/:matchId" element={<Viewer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
