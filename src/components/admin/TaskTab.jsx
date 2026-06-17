import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const emptyForm = { day_number: 1, title: '' }

export default function TaskTab() {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [filterDay, setFilterDay] = useState('')

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('day_number').order('created_at')
    if (data) setTasks(data)
  }

  useEffect(() => { fetchTasks() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    if (editId) {
      await supabase.from('tasks').update({ day_number: form.day_number, title: form.title }).eq('id', editId)
    } else {
      await supabase.from('tasks').insert({ day_number: form.day_number, title: form.title })
    }
    setForm(emptyForm)
    setEditId(null)
    fetchTasks()
  }

  const handleEdit = (t) => {
    setForm({ day_number: t.day_number, title: t.title })
    setEditId(t.id)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  const days = [...new Set(tasks.map((t) => t.day_number))].sort((a, b) => a - b)
  const filtered = filterDay ? tasks.filter((t) => t.day_number === parseInt(filterDay)) : tasks

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-5 flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-gray-400 text-xs block mb-1">Day</label>
          <select
            value={form.day_number}
            onChange={(e) => setForm({ ...form, day_number: parseInt(e.target.value) })}
            className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="text-gray-400 text-xs block mb-1">할 일 내용</label>
          <input
            type="text"
            placeholder="할 일을 입력하세요"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl px-5 py-2 transition"
        >
          {editId ? '수정 완료' : '추가'}
        </button>
        {editId && (
          <button
            type="button"
            onClick={() => { setForm(emptyForm); setEditId(null) }}
            className="bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-xl px-5 py-2 transition"
          >
            취소
          </button>
        )}
      </form>

      <div className="flex gap-3">
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">전체 Day</option>
          {days.map((d) => <option key={d} value={d}>Day {d}</option>)}
        </select>
      </div>

      <div className="bg-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">Day</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">할 일</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">날짜</th>
              <th className="px-4 py-3 text-gray-300 font-semibold text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-gray-700">
                <td className="px-4 py-3">
                  <span className="bg-purple-900/50 text-purple-300 rounded text-xs px-2 py-1">Day {t.day_number}</span>
                </td>
                <td className="px-4 py-3 text-white">{t.title}</td>
                <td className="px-4 py-3 text-gray-400">{t.target_date || '미설정'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => handleEdit(t)} className="text-blue-400 hover:text-blue-300 text-xs border border-blue-600 rounded px-2 py-1">수정</button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-300 text-xs border border-red-700 rounded px-2 py-1">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
