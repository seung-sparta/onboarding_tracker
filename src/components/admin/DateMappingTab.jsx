import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function DateMappingTab() {
  const [days, setDays] = useState([])
  const [dateMap, setDateMap] = useState({})
  const [taskCounts, setTaskCounts] = useState({})
  const [mappedCounts, setMappedCounts] = useState({})
  const [saving, setSaving] = useState({})

  const fetchDays = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('day_number, target_date').order('day_number')
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
  }, [])

  useEffect(() => {
    fetchDays()
  }, [fetchDays])

  const handleSave = async (dayNumber) => {
    const date = dateMap[dayNumber] || null
    setSaving((prev) => ({ ...prev, [dayNumber]: true }))
    await supabase.from('tasks').update({ target_date: date }).eq('day_number', dayNumber)
    await fetchDays()
    setSaving((prev) => ({ ...prev, [dayNumber]: false }))
  }

  const handleSync = async (dayNumber) => {
    const date = dateMap[dayNumber]
    if (!date) return
    setSaving((prev) => ({ ...prev, [dayNumber]: true }))
    await supabase.from('tasks').update({ target_date: date }).eq('day_number', dayNumber)
    await fetchDays()
    setSaving((prev) => ({ ...prev, [dayNumber]: false }))
  }

  const hasUnmapped = (day) => {
    const total = taskCounts[day] || 0
    const mapped = mappedCounts[day] || 0
    return total > mapped
  }

  const unmappedCount = (day) => (taskCounts[day] || 0) - (mappedCounts[day] || 0)

  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm">각 Day에 해당하는 실제 날짜를 설정하세요. 날짜를 입력 후 포커스를 벗어나면 자동 저장됩니다.</p>

      <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
        {days.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 할 일이 없습니다. 먼저 할 일을 추가해주세요.</p>
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
    </div>
  )
}
