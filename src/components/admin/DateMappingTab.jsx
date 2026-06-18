import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function DateMappingTab() {
  const [days, setDays] = useState([])
  const [dateMap, setDateMap] = useState({})
  const [taskCounts, setTaskCounts] = useState({})
  const [mappedCounts, setMappedCounts] = useState({})
  const [saving, setSaving] = useState({})
  const [selectedTrack, setSelectedTrack] = useState('')
  const [selectedCohort, setSelectedCohort] = useState('')
  const [tracks, setTracks] = useState([])
  const [cohorts, setCohorts] = useState([])

  useEffect(() => {
    supabase.from('students').select('track, cohort').then(({ data }) => {
      if (data) {
        setTracks([...new Set(data.map((s) => s.track))])
        setCohorts([...new Set(data.map((s) => s.cohort))])
      }
    })
  }, [])

  const fetchDays = useCallback(async () => {
    if (!selectedTrack || !selectedCohort) return
    const { data } = await supabase
      .from('tasks')
      .select('day_number, target_date')
      .eq('track', selectedTrack)
      .eq('cohort', selectedCohort)
      .order('day_number')
    if (!data) return

    const uniqueDays = [...new Set(data.map((t) => t.day_number))].sort((a, b) => a - b)
    setDays(uniqueDays)

    const map = {}
    const totals = {}
    const mapped = {}

    data.forEach((t) => {
      totals[t.day_number] = (totals[t.day_number] || 0) + 1
      if (t.target_date) {
        map[t.day_number] = t.target_date
        mapped[t.day_number] = (mapped[t.day_number] || 0) + 1
      }
    })

    setDateMap(map)
    setTaskCounts(totals)
    setMappedCounts(mapped)
  }, [selectedTrack, selectedCohort])

  useEffect(() => {
    setDays([])
    setDateMap({})
    setTaskCounts({})
    setMappedCounts({})
    fetchDays()
  }, [fetchDays])

  const handleSave = async (dayNumber) => {
    const date = dateMap[dayNumber] || null
    setSaving((prev) => ({ ...prev, [dayNumber]: true }))
    await supabase
      .from('tasks')
      .update({ target_date: date })
      .eq('day_number', dayNumber)
      .eq('track', selectedTrack)
      .eq('cohort', selectedCohort)
    await fetchDays()
    setSaving((prev) => ({ ...prev, [dayNumber]: false }))
  }

  const handleSync = async (dayNumber) => {
    const date = dateMap[dayNumber]
    if (!date) return
    setSaving((prev) => ({ ...prev, [dayNumber]: true }))
    await supabase
      .from('tasks')
      .update({ target_date: date })
      .eq('day_number', dayNumber)
      .eq('track', selectedTrack)
      .eq('cohort', selectedCohort)
    await fetchDays()
    setSaving((prev) => ({ ...prev, [dayNumber]: false }))
  }

  const unmappedCount = (day) => (taskCounts[day] || 0) - (mappedCounts[day] || 0)
  const isReady = selectedTrack && selectedCohort

  return (
    <div className="space-y-6">
      {/* 트랙·기수 선택 */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={selectedTrack}
          onChange={(e) => { setSelectedTrack(e.target.value); setSelectedCohort('') }}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">트랙 선택</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={selectedCohort}
          onChange={(e) => setSelectedCohort(e.target.value)}
          disabled={!selectedTrack}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
        >
          <option value="">기수 선택</option>
          {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isReady && (
          <p className="text-gray-400 text-sm">
            날짜 입력 후 포커스를 벗어나면 자동 저장됩니다.
          </p>
        )}
      </div>

      {!isReady ? (
        <div className="bg-gray-800 rounded-2xl px-6 py-10 text-center text-gray-500 text-sm">
          트랙과 기수를 선택하면 날짜 매핑이 표시됩니다
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
          {days.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {selectedTrack} · {selectedCohort}에 등록된 할 일이 없습니다. 먼저 할 일을 추가해주세요.
            </p>
          ) : (
            days.map((day) => {
              const total = taskCounts[day] || 0
              const mapped = mappedCounts[day] || 0
              const unmapped = total - mapped
              const hasIssue = unmapped > 0 && dateMap[day]

              return (
                <div key={day} className="space-y-1">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span className="bg-purple-900/50 text-purple-300 rounded text-sm px-3 py-1.5 text-center font-semibold flex-1">
                        Day {day}
                      </span>
                      {hasIssue && (
                        <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" title={`미매핑 ${unmapped}개`} />
                      )}
                    </div>
                    <input
                      type="date"
                      value={dateMap[day] || ''}
                      onChange={(e) => setDateMap((prev) => ({ ...prev, [day]: e.target.value }))}
                      onBlur={() => handleSave(day)}
                      className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className={`text-xs ${unmapped > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                      {mapped}/{total} 매핑됨
                    </span>
                    {hasIssue && (
                      <button
                        onClick={() => handleSync(day)}
                        disabled={saving[day]}
                        className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition disabled:opacity-50 flex-shrink-0"
                      >
                        {saving[day] ? '동기화 중...' : `미매핑 ${unmapped}개 동기화`}
                      </button>
                    )}
                    {saving[day] && !hasIssue && <span className="text-xs text-gray-500">저장 중...</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
