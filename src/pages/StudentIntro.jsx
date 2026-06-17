import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function StudentIntro() {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState([])
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    setCandidates([])

    const { data, error: dbError } = await supabase
      .from('students')
      .select('*')
      .eq('name', name.trim())

    setLoading(false)

    if (dbError) {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
      return
    }

    if (!data || data.length === 0) {
      setError('등록된 수강생을 찾을 수 없습니다.')
      return
    }

    if (data.length === 1) {
      sessionStorage.setItem('student', JSON.stringify(data[0]))
      navigate('/student')
    } else {
      setCandidates(data)
    }
  }

  const handleSelectStudent = (student) => {
    sessionStorage.setItem('student', JSON.stringify(student))
    navigate('/student')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src="/check-ltani.png" alt="르탄이" className="w-32 h-32 object-contain mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 text-center">캠프에 오신 것을 환영해요!</h1>
          <p className="text-gray-500 mt-2 text-center">수강생의 이름을 입력하세요!</p>
        </div>

        {candidates.length === 0 ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50"
            >
              {loading ? '확인 중...' : '시작하기'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm text-center">여러 명이 검색되었습니다. 선택해주세요.</p>
            {candidates.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectStudent(s)}
                className="w-full border border-purple-200 rounded-xl px-4 py-3 text-left hover:bg-purple-50 transition"
              >
                <span className="font-semibold text-gray-800">{s.name}</span>
                <span className="text-gray-500 text-sm ml-2">{s.track} / {s.cohort}</span>
              </button>
            ))}
            <button
              onClick={() => setCandidates([])}
              className="w-full py-2 text-gray-400 text-sm hover:text-gray-600"
            >
              다시 입력하기
            </button>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/admin" className="text-xs text-gray-400 hover:text-gray-600 underline">
            관리자 로그인
          </Link>
        </div>
      </div>
    </div>
  )
}
