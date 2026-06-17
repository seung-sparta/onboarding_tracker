import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardTab() {
  const [tracks, setTracks] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [availableDays, setAvailableDays] = useState([])
  const [selectedTrack, setSelectedTrack] = useState('')
  const [selectedCohort, setSelectedCohort] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [students, setStudents] = useState([])
  const [taskCount, setTaskCount] = useState(0)
  const [unmappedCount, setUnmappedCount] = useState(0)
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    const fetchFilters = async () => {
      const [{ data: studentData }, { data: taskData }] = await Promise.all([
        supabase.from('students').select('track, cohort'),
        supabase.from('tasks').select('target_date, day_number').not('target_date', 'is', null).order('target_date'),
      ])
      if (studentData) {
        setTracks([...new Set(studentData.map((s) => s.track))])
        setCohorts([...new Set(studentData.map((s) => s.cohort))])
      }
      if (taskData) {
        const seen = new Set()
        const days = []
        taskData.forEach((t) => {
          if (!seen.has(t.day_number)) {
            seen.add(t.day_number)
            days.push(t.day_number)
          }
        })
        days.sort((a, b) => a - b)
        setAvailableDays(days)
      }
    }
    fetchFilters()
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedTrack || !selectedCohort) return
    setLoading(true)

    let mappedQuery = supabase.from('tasks').select('id').not('target_date', 'is', null)
    let unmappedQuery = supabase.from('tasks').select('id', { count: 'exact', head: true }).is('target_date', null)

    if (selectedDay !== '') {
      mappedQuery = mappedQuery.eq('day_number', Number(selectedDay))
      unmappedQuery = unmappedQuery.eq('day_number', Number(selectedDay))
    }

    const [{ data: studentData }, { data: taskData }, { count: unmapped }] = await Promise.all([
      supabase.from('students').select('*').eq('track', selectedTrack).eq('cohort', selectedCohort),
      mappedQuery,
      unmappedQuery,
    ])

    setTaskCount(taskData?.length || 0)
    setUnmappedCount(unmapped || 0)

    if (studentData && taskData && taskData.length > 0) {
      const studentIds = studentData.map((s) => s.id)
      const taskIds = taskData.map((t) => t.id)

      const { data: progressData } = await supabase
        .from('progress')
        .select('student_id')
        .in('student_id', studentIds)
        .in('task_id', taskIds)
        .eq('is_completed', true)

      const map = {}
      studentIds.forEach((id) => { map[id] = 0 })
      progressData?.forEach((p) => {
        map[p.student_id] = (map[p.student_id] || 0) + 1
      })
      setProgressMap(map)
      setStudents(studentData)
    } else if (studentData) {
      const map = {}
      studentData.forEach((s) => { map[s.id] = 0 })
      setProgressMap(map)
      setStudents(studentData)
    }

    setLoading(false)
    setLastUpdated(new Date())
  }, [selectedTrack, selectedCohort, selectedDay])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 300000)
    return () => clearInterval(interval)
  }, [fetchData])

  const getPercent = (studentId) => {
    if (taskCount === 0) return 0
    return Math.round(((progressMap[studentId] || 0) / taskCount) * 100)
  }

  const lowAchievers = students.filter((s) => getPercent(s.id) <= 50)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedTrack}
          onChange={(e) => setSelectedTrack(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">트랙 선택</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">기수 선택</option>
          {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">전체 기간</option>
          {availableDays.map((day) => (
            <option key={day} value={day}>Day {day}</option>
          ))}
        </select>
        {selectedTrack && selectedCohort && (
          <div className="flex items-center gap-3 ml-auto">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 border border-gray-600 text-gray-300 hover:text-white hover:border-purple-500 transition text-sm disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        )}
      </div>

      {unmappedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          날짜 미매핑 할 일 {unmappedCount}개가 집계에서 제외되고 있습니다. 날짜 매핑 탭에서 동기화하세요.
        </div>
      )}

      {selectedTrack && selectedCohort && (
        <>
          {loading ? (
            <p className="text-gray-400">불러오는 중...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-2xl p-5">
                  <p className="text-gray-400 text-sm mb-1">총 수강생</p>
                  <p className="text-3xl font-bold text-white">{students.length}명</p>
                </div>
                <div className="bg-gray-800 rounded-2xl p-5">
                  <p className="text-gray-400 text-sm mb-1">달성률 50% 이하</p>
                  <p className="text-3xl font-bold text-red-400">{lowAchievers.length}명</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-300 font-semibold">이름</th>
                      <th className="text-right px-4 py-3 text-gray-300 font-semibold">완료</th>
                      <th className="text-right px-4 py-3 text-gray-300 font-semibold">달성률</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold w-40">진행 바</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const pct = getPercent(s.id)
                      const isLow = pct <= 50
                      return (
                        <tr key={s.id} className={`border-t border-gray-700 ${isLow ? 'bg-red-900/40' : ''}`}>
                          <td className="px-4 py-3 text-white">{s.name}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{progressMap[s.id] || 0}/{taskCount}</td>
                          <td className={`px-4 py-3 text-right font-bold ${isLow ? 'text-red-400' : 'text-green-400'}`}>{pct}%</td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
