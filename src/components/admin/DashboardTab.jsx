import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardTab() {
  const [tracks, setTracks] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [availableDays, setAvailableDays] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(() => localStorage.getItem('admin_track') || '')
  const [selectedCohort, setSelectedCohort] = useState(() => localStorage.getItem('admin_cohort') || '')
  const [selectedDay, setSelectedDay] = useState('')
  const [students, setStudents] = useState([])
  const [taskCount, setTaskCount] = useState(0)
  const [unmappedCount, setUnmappedCount] = useState(0)
  const [progressMap, setProgressMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('dashboard_threshold') ?? 50))
  const [filterRate, setFilterRate] = useState('all')

  const [detailStudent, setDetailStudent] = useState(null)
  const [detailTasks, setDetailTasks] = useState([])
  const [detailCustomTasks, setDetailCustomTasks] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const detailIntervalRef = useRef(null)

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

  const fetchDetailTasks = useCallback(async (student) => {
    setDetailLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .not('target_date', 'is', null)
      .eq('track', student.track)
      .eq('cohort', student.cohort)
      .order('day_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (selectedDay !== '') query = query.eq('day_number', Number(selectedDay))

    const { data: taskData } = await query

    if (taskData && taskData.length > 0) {
      const { data: progressData } = await supabase
        .from('progress')
        .select('task_id, is_completed, completed_at')
        .eq('student_id', student.id)
        .in('task_id', taskData.map((t) => t.id))

      const progressMap = {}
      progressData?.forEach((p) => { progressMap[p.task_id] = p })

      setDetailTasks(taskData.map((t) => ({ ...t, progress: progressMap[t.id] || null })))
    } else {
      setDetailTasks([])
    }

    // 중간 합류자 추가 할 일 조회
    let customTasks = []
    if (student.is_late_joiner) {
      let customQuery = supabase
        .from('student_custom_tasks')
        .select('*')
        .eq('student_id', student.id)
        .order('target_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (selectedDay !== '') {
        // 선택된 Day의 target_date와 일치하는 추가 할 일만 표시
        const targetDate = taskData?.[0]?.target_date ?? null
        if (targetDate) {
          customQuery = customQuery.eq('target_date', targetDate)
          const { data: customData } = await customQuery
          customTasks = customData || []
        }
      } else {
        const { data: customData } = await customQuery
        customTasks = customData || []
      }
    }
    setDetailCustomTasks(customTasks)

    setDetailLoading(false)
  }, [selectedDay])

  const openDetail = useCallback((student) => {
    setDetailStudent(student)
    fetchDetailTasks(student)
    detailIntervalRef.current = setInterval(() => fetchDetailTasks(student), 10000)
  }, [fetchDetailTasks])

  const closeDetail = useCallback(() => {
    setDetailStudent(null)
    setDetailTasks([])
    setDetailCustomTasks([])
    if (detailIntervalRef.current) {
      clearInterval(detailIntervalRef.current)
      detailIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (detailIntervalRef.current) clearInterval(detailIntervalRef.current)
    }
  }, [])

  const getPercent = (studentId) => {
    if (taskCount === 0) return 0
    return Math.round(((progressMap[studentId] || 0) / taskCount) * 100)
  }

  const lowAchievers = students.filter((s) => getPercent(s.id) <= threshold)
  const withdrawnStudents = students.filter((s) => s.is_withdrawn)

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
          onChange={(e) => { setSelectedTrack(e.target.value); localStorage.setItem('admin_track', e.target.value); setSelectedCohort(''); localStorage.removeItem('admin_cohort') }}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">트랙 선택</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={selectedCohort}
          onChange={(e) => { setSelectedCohort(e.target.value); localStorage.setItem('admin_cohort', e.target.value) }}
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
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-2xl p-5">
                  <p className="text-gray-400 text-sm mb-1">총 수강생</p>
                  <p className="text-3xl font-bold text-white">{students.length}명</p>
                </div>
                <div className="relative group bg-gray-800 rounded-2xl p-5 cursor-default">
                  <p className="text-gray-400 text-sm mb-1">지원 철회</p>
                  <p className="text-3xl font-bold text-gray-400">{withdrawnStudents.length}명</p>
                  {withdrawnStudents.length > 0 && (
                    <div className="absolute top-full left-0 mt-2 z-50 hidden group-hover:block bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-3 min-w-[160px]">
                      <p className="text-gray-500 text-xs mb-2 font-semibold">지원 철회자</p>
                      <ul className="space-y-1">
                        {withdrawnStudents.map((s) => (
                          <li key={s.id} className="text-gray-300 text-sm">{s.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                      <th className="px-4 py-3"></th>
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
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openDetail(s)}
                              className="text-xs text-purple-400 hover:text-purple-300 border border-purple-700 hover:border-purple-500 rounded-lg px-2.5 py-1 transition whitespace-nowrap"
                            >
                              자세히 보기
                            </button>
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

      {/* 자세히 보기 모달 */}
      {detailStudent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-gray-700 flex-shrink-0">
              <div>
                <h3 className="text-white font-bold text-base">{detailStudent.name}님의 할 일 현황</h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  {detailTasks.filter((t) => t.progress?.is_completed).length + detailCustomTasks.filter((t) => t.is_completed).length}/{detailTasks.length + detailCustomTasks.length} 완료 · 10초마다 자동 갱신
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchDetailTasks(detailStudent)}
                  disabled={detailLoading}
                  className="text-gray-400 hover:text-white transition disabled:opacity-40"
                  title="새로고침"
                >
                  <svg className={`w-4 h-4 ${detailLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button onClick={closeDetail} className="text-gray-400 hover:text-white transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 할 일 목록 */}
            <div className="overflow-y-auto flex-1 p-5">
              {detailLoading && detailTasks.length === 0 && detailCustomTasks.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">불러오는 중...</p>
              ) : detailTasks.length === 0 && detailCustomTasks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">등록된 할 일이 없습니다.</p>
              ) : (
                <div className="space-y-5">
                  {detailTasks.length > 0 && <DetailTaskList tasks={detailTasks} />}
                  {detailCustomTasks.length > 0 && <CustomTaskList tasks={detailCustomTasks} />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomTaskList({ tasks }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2.5 py-0.5 rounded-full">
          추가 할 일
        </span>
        <span className="text-xs text-gray-500">
          {tasks.filter((t) => t.is_completed).length}/{tasks.length}
        </span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>
      <ul className="space-y-2">
        {tasks.map((task) => {
          const done = task.is_completed
          const completedAt = task.completed_at
            ? new Date(task.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <li key={task.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${done ? 'bg-green-900/20 border border-green-700/40' : 'bg-gray-700/50 border border-gray-700'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500' : 'border-2 border-gray-500'}`}>
                {done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`flex-1 text-sm ${done ? 'text-green-300' : 'text-gray-300'}`}>
                {task.title}
              </span>
              {completedAt && (
                <span className="text-xs text-gray-500 flex-shrink-0">{completedAt}</span>
              )}
              {!done && (
                <span className="text-xs text-gray-600 flex-shrink-0">미완료</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DetailTaskList({ tasks }) {
  const byDay = tasks.reduce((acc, t) => {
    const key = t.day_number
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const days = Object.keys(byDay).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const dayTasks = byDay[day]
        const doneCount = dayTasks.filter((t) => t.progress?.is_completed).length
        return (
          <div key={day}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2.5 py-0.5 rounded-full">
                Day {day}
              </span>
              <span className="text-xs text-gray-500">{doneCount}/{dayTasks.length}</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>
            <ul className="space-y-2">
              {dayTasks.map((task) => {
                const done = task.progress?.is_completed
                const completedAt = task.progress?.completed_at
                  ? new Date(task.progress.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                  : null
                return (
                  <li key={task.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${done ? 'bg-green-900/20 border border-green-700/40' : 'bg-gray-700/50 border border-gray-700'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500' : 'border-2 border-gray-500'}`}>
                      {done && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`flex-1 text-sm ${done ? 'text-green-300' : 'text-gray-300'}`}>
                      {task.title}
                    </span>
                    {completedAt && (
                      <span className="text-xs text-gray-500 flex-shrink-0">{completedAt}</span>
                    )}
                    {!done && (
                      <span className="text-xs text-gray-600 flex-shrink-0">미완료</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
