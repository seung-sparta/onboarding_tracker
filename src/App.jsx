import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import StudentIntro from './pages/StudentIntro'
import StudentMain from './pages/StudentMain'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentIntro />} />
        <Route path="/student" element={<StudentMain />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
