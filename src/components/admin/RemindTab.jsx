import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const DEFAULT_MESSAGE = '퇴실까지 1시간 남았어요! 지금까지 한 일은 모두 체크해주세요!'

const emptyForm = { track: '', cohort: '', remind_time: '15:00', message: DEFAULT_MESSAGE }

export default function RemindTab() {
  const [reminders, setReminders] = useState([])
  const [pairs, setPairs] = useState([])
  const [tracks, setTracks] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('students').select('track, cohort').then(({ data }) => {
      if (data) {
        setPairs(data)
        setTracks([...new Set(data.map((s) => s.track))])
      }
    })
  }, [])

  const fetchReminders = useCallback(async () => {
    const { data } = await supabase.from('reminders').select('*').order('track').order('cohort')
    if (data) setReminders(data)
  }, [])

  useEffect(() => { fetchReminders() }, [fetchReminders])

  const availableCohorts = form.track
    ? [...new Set(pairs.filter((p) => p.track === form.track).map((p) => p.cohort))]
    : []

  const handleTrackChange = (track) => {
    setForm({ ...form, track, cohort: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.track || !form.cohort || !form.remind_time) return
    setSaving(true)
    if (editId) {
      await supabase.from('reminders').update({
        remind_time: form.remind_time,
        message: form.message.trim() || DEFAULT_MESSAGE,
      }).eq('id', editId)
    } else {
      await supabase.from('reminders').upsert({
        track: form.track,
        cohort: form.cohort,
        remind_time: form.remind_time,
        message: form.message.trim() || DEFAULT_MESSAGE,
      }, { onConflict: 'track,cohort' })
    }
    setSaving(false)
    setForm(emptyForm)
    setEditId(null)
    fetchReminders()
  }

  const handleEdit = (r) => {
    setForm({
      track: r.track,
      cohort: r.cohort,
      remind_time: r.remind_time.slice(0, 5),
      message: r.message,
    })
    setEditId(r.id)
  }

  const handleCancel = () => {
    setForm(emptyForm)
    setEditId(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 리마인드 설정을 삭제하시겠습니까?')) return
    await supabase.from('reminders').delete().eq('id', id)
    fetchReminders()
  }

  return (
    <div className="space-y-6">
      {/* 설정 폼 */}
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-bold text-sm">
          {editId ? '리마인드 수정' : '리마인드 추가'}
        </h3>

        <div className="flex gap-3 flex-wrap">
          <select
            value={form.track}
            onChange={(e) => handleTrackChange(e.target.value)}
            disabled={!!editId}
            className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <option value="">트랙 선택</option>
            {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={form.cohort}
            onChange={(e) => setForm({ ...form, cohort: e.target.value })}
            disabled={!!editId || !form.track}
            className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <option value="">기수 선택</option>
            {availableCohorts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2">
            <label className="text-gray-400 text-sm whitespace-nowrap">알람 시간</label>
            <input
              type="time"
              value={form.remind_time}
              onChange={(e) => setForm({ ...form, remind_time: e.target.value })}
              className="bg-transparent text-white text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-gray-400 text-xs">리마인드 메시지</label>
          <textarea
            rows={2}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder={DEFAULT_MESSAGE}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 resize-none"
          />
          <p className="text-gray-600 text-xs">비워두면 기본 메시지로 저장됩니다.</p>
        </div>

        {/* 미리보기 */}
        <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-4 flex items-center gap-4">
          <img src="/check-ltani.png" alt="르탄이" className="w-14 h-14 object-contain flex-shrink-0" />
          <div>
            <p className="text-gray-400 text-xs mb-1">미리보기</p>
            <p className="text-white text-sm font-medium leading-snug whitespace-pre-line">
              {form.message.trim() || DEFAULT_MESSAGE}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.track || !form.cohort || !form.remind_time}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl px-5 py-2 transition disabled:opacity-50"
          >
            {saving ? '저장 중...' : editId ? '수정 완료' : '저장'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-xl px-5 py-2 transition"
            >
              취소
            </button>
          )}
        </div>
      </form>

      {/* 리마인드 목록 */}
      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">트랙</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">기수</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">알람 시간</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">메시지</th>
              <th className="px-4 py-3 text-gray-300 font-semibold text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {reminders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  등록된 리마인드 설정이 없습니다
                </td>
              </tr>
            ) : (
              reminders.map((r) => (
                <tr key={r.id} className="border-t border-gray-700">
                  <td className="px-4 py-3 text-white">{r.track}</td>
                  <td className="px-4 py-3 text-gray-300">{r.cohort}</td>
                  <td className="px-4 py-3">
                    <span className="bg-purple-900/50 text-purple-300 rounded text-xs px-2 py-1 font-mono">
                      {r.remind_time.slice(0, 5)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs max-w-xs truncate">{r.message}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(r)}
                      className="text-blue-400 hover:text-blue-300 text-xs border border-blue-600 rounded px-2 py-1"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-300 text-xs border border-red-700 rounded px-2 py-1"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
