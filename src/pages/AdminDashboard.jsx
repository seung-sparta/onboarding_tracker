import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardTab from '../components/admin/DashboardTab'
import StudentTab from '../components/admin/StudentTab'
import TaskTab from '../components/admin/TaskTab'
import DateMappingTab from '../components/admin/DateMappingTab'
import SettingsTab from '../components/admin/SettingsTab'
import ScheduleTab from '../components/admin/ScheduleTab'

const TABS = [
  { key: 'dashboard', label: '트래킹' },
  { key: 'students', label: '수강생 관리' },
  { key: 'tasks', label: '할 일 관리' },
  { key: 'dates', label: '날짜 매핑' },
  { key: 'schedule', label: '수업 시간' },
  { key: 'settings', label: '설정' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    const stored = sessionStorage.getItem('admin')
    if (!stored) {
      navigate('/admin')
      return
    }
    setAdmin(JSON.parse(stored))
  }, [navigate])

  const handleLogout = () => {
    sessionStorage.removeItem('admin')
    navigate('/admin')
  }

  if (!admin) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800 px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-bold text-white">온보딩 트래커</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">{admin.name}님</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg px-3 py-1.5 transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 탭 컨텐츠 */}
      <main className="p-6">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'students' && <StudentTab onGoToTasks={() => setActiveTab('tasks')} />}
        {activeTab === 'tasks' && <TaskTab />}
        {activeTab === 'dates' && <DateMappingTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'settings' && <SettingsTab admin={admin} setAdmin={setAdmin} />}
      </main>
    </div>
  )
}
