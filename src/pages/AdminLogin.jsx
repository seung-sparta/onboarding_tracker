import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLogin() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || pin.length !== 6) {
      setError('이름과 PIN 6자리를 모두 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('admins')
      .select('*')
      .eq('name', name.trim())
      .eq('pin_code', pin)
      .single()

    setLoading(false)

    if (dbError || !data) {
      setError('이름 또는 PIN 코드가 올바르지 않습니다.')
      return
    }

    sessionStorage.setItem('admin', JSON.stringify(data))
    navigate('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-8">관리자 로그인</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">관리자 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">PIN 코드</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPin(val)
              }}
              placeholder="PIN 코드를 입력해주세요."
              maxLength={6}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 mt-2"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
            수강생 화면으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
