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
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('dashboard_threshold') ?? 50))
  const [filterRate, setFilterRate] = useState('all')

  useEffect(() => {
    supabase.from('students').select('track, cohort').then(({ data }) => {
      if (data) {
        setTracks([...new Set(data.map((s) => s.track))])
        setCohorts([...new Set(data.map((s) => s.cohort))])
      }
    })
  }, [])

  useEffect(() => {
    setAvailableDays([])
    setSelectedDay('')
    if (!selectedTrack || !selectedCohort) return
    supabase
      .from('tasks')
      .select('day_number')
      .eq('track', selectedTrack)
      .eq('cohort', selectedCohort)
      .not('target_date', 'is', null)
      .then(({ data }) => {
        if (data) {
          const days = [...new Set(data.map((t) => t.day_number))].sort((a, b) => a - b)
          setAvailableDays(days)
        }
      })
  }, [selectedTrack, selectedCohort])

  const fetchData = useCallback(async () => {
    if (!selectedTrack || !selectedCohort) return
    setLoading(true)

    let mappedQuery = supabase.from('tasks').select('id').not('target_date', 'is', null).eq('track', selectedTrack).eq('cohort', selectedCohort)
    let unmappedQuery = supabase.from('tasks').select('id', { count: 'exact', head: true }).is('target_date', null).eq('track', selectedTrack).eq('cohort', selectedCohort)

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

  const lowAchievers = students.filter((s) => getPercent(s.id) <= threshold)

  const displayedStudents = students.filter((s) => {
    if (filterRate === 'all') return true
    const pct = getPercent(s.id)
    const min = Number(filterRate)
    const max = min + 10
    return min === 90 ? pct >= 90 : pct >= min && pct < max
  })

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

        <div className="flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2">
          <label className="text-gray-400 text-sm whitespace-nowrap">기준치</label>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={threshold}
            onChange={(e) => {
              const v = Math.min(100, Math.max(0, Number(e.target.value)))
              setThreshold(v)
              localStorage.setItem('dashboard_threshold', v)
            }}
            className="w-14 bg-transparent text-white text-sm text-right focus:outline-none"
          />
          <span className="text-gray-400 text-sm">%</span>
        </div>

        <select
          value={filterRate}
          onChange={(e) => setFilterRate(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">전체 달성률</option>
          {[0,10,20,30,40,50,60,70,80,90].map((n) => (
            <option key={n} value={n}>
              {n === 90 ? '90% 이상' : `${n}~${n+10}%`}
            </option>
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
                  <p className="text-gray-400 text-sm mb-1">달성률 {threshold}% 이하</p>
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
                    {displayedStudents.map((s) => {
                      const pct = getPercent(s.id)
                      const isLow = pct <= threshold
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
