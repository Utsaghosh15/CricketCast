import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Scoring from './pages/Scoring'
import Viewer from './pages/Viewer'
import AdminGate from './components/AdminGate'

function RedirectMatchToWatch() {
  const { matchId } = useParams()
  return <Navigate to={`/watch/${encodeURIComponent(matchId || '')}`} replace />
}

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
        <Route path="/watch/:matchId" element={<Viewer />} />
        <Route path="/match/:matchId" element={<RedirectMatchToWatch />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
