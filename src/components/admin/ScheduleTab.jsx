import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ScheduleTab() {
  const [schedules, setSchedules] = useState([])
  const [tracks, setTracks] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({ track: '', cohort: '', start_time: '09:00', end_time: '18:00' })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: scheduleData }, { data: studentData }] = await Promise.all([
      supabase.from('class_schedules').select('*').order('track').order('cohort'),
      supabase.from('students').select('track, cohort'),
    ])
    if (scheduleData) setSchedules(scheduleData)
    if (studentData) {
      setTracks([...new Set(studentData.map((s) => s.track))])
      setCohorts([...new Set(studentData.map((s) => s.cohort))])
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    if (!form.track || !form.cohort) { setFormError('트랙과 기수를 선택해주세요.'); return }
    if (form.start_time >= form.end_time) { setFormError('종료 시간이 시작 시간보다 늦어야 합니다.'); return }

    setSaving(true)
    const { error } = await supabase
      .from('class_schedules')
      .upsert({ ...form }, { onConflict: 'track,cohort' })
    setSaving(false)

    if (error) { setFormError('저장 중 오류가 발생했습니다.'); return }
    setFormSuccess(`${form.track} ${form.cohort} 수업 시간이 저장되었습니다.`)
    setForm({ track: '', cohort: '', start_time: '09:00', end_time: '18:00' })
    setEditingId(null)
    fetchAll()
  }

  const handleEdit = (s) => {
    setForm({ track: s.track, cohort: s.cohort, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) })
    setEditingId(s.id)
    setFormError('')
    setFormSuccess('')
  }

  const handleDelete = async (id, track, cohort) => {
    if (!window.confirm(`${track} ${cohort} 수업 시간을 삭제하시겠습니까?`)) return
    await supabase.from('class_schedules').delete().eq('id', id)
    fetchAll()
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm({ track: '', cohort: '', start_time: '09:00', end_time: '18:00' })
    setFormError('')
    setFormSuccess('')
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* 저장된 수업 시간 목록 */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">트랙별 수업 시간</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        ) : schedules.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 수업 시간이 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">트랙</th>
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">기수</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">시작</th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">종료</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-t border-gray-700">
                    <td className="px-4 py-3 text-white">{s.track}</td>
                    <td className="px-4 py-3 text-gray-300">{s.cohort}</td>
                    <td className="px-4 py-3 text-center text-purple-300 font-mono">{s.start_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-center text-purple-300 font-mono">{s.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(s)}
                          className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg px-3 py-1 transition"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.track, s.cohort)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded-lg px-3 py-1 transition"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록/수정 폼 */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">
          {editingId ? '수업 시간 수정' : '수업 시간 등록'}
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-gray-400 text-sm block mb-1">트랙</label>
              <select
                value={form.track}
                onChange={(e) => setForm({ ...form, track: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">트랙 선택</option>
                {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-sm block mb-1">기수</label>
              <select
                value={form.cohort}
                onChange={(e) => setForm({ ...form, cohort: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">기수 선택</option>
                {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-gray-400 text-sm block mb-1">수업 시작</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-sm block mb-1">수업 종료 (퇴실)</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          {formSuccess && <p className="text-green-400 text-sm">{formSuccess}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : editingId ? '수정 완료' : '등록'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2.5 rounded-xl font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
