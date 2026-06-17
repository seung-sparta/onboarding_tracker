import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const emptyForm = { name: '', track: '', cohort: '' }

export default function StudentTab() {
  const [students, setStudents] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [filterTrack, setFilterTrack] = useState('')
  const [filterCohort, setFilterCohort] = useState('')
  const [tracks, setTracks] = useState([])
  const [cohorts, setCohorts] = useState([])

  const [modalStudent, setModalStudent] = useState(null)
  const [customTaskDate, setCustomTaskDate] = useState('')
  const [customTasks, setCustomTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const [bulkModal, setBulkModal] = useState(false)
  const [bulkDate, setBulkDate] = useState('')
  const [bulkTitles, setBulkTitles] = useState([])
  const [bulkInput, setBulkInput] = useState('')
  const [bulkSelected, setBulkSelected] = useState([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkTrack, setBulkTrack] = useState('')
  const [bulkCohort, setBulkCohort] = useState('')

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false })
    if (data) {
      setStudents(data)
      setTracks([...new Set(data.map((s) => s.track))])
      setCohorts([...new Set(data.map((s) => s.cohort))])
    }
  }

  useEffect(() => { fetchStudents() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.track.trim() || !form.cohort.trim()) return
    if (editId) {
      await supabase.from('students').update(form).eq('id', editId)
    } else {
      await supabase.from('students').insert(form)
    }
    setForm(emptyForm)
    setEditId(null)
    fetchStudents()
  }

  const handleEdit = (s) => {
    setForm({ name: s.name, track: s.track, cohort: s.cohort })
    setEditId(s.id)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  const toggleLateJoiner = async (s) => {
    const newVal = !s.is_late_joiner
    await supabase.from('students').update({ is_late_joiner: newVal }).eq('id', s.id)
    fetchStudents()
  }

  const updateJoinDate = async (id, date) => {
    await supabase.from('students').update({ join_date: date || null }).eq('id', id)
    fetchStudents()
  }

  const fetchCustomTasks = async (studentId, date) => {
    const { data } = await supabase
      .from('student_custom_tasks')
      .select('*')
      .eq('student_id', studentId)
      .eq('target_date', date)
      .order('created_at')
    setCustomTasks(data || [])
  }

  const openModal = async (student) => {
    const todayStr = new Date().toLocaleDateString('en-CA')
    setModalStudent(student)
    setCustomTaskDate(todayStr)
    setNewTaskTitle('')
    await fetchCustomTasks(student.id, todayStr)
  }

  const handleDateChange = async (date) => {
    setCustomTaskDate(date)
    if (modalStudent) await fetchCustomTasks(modalStudent.id, date)
  }

  const addCustomTask = async () => {
    if (!newTaskTitle.trim() || !modalStudent) return
    setAddingTask(true)
    await supabase.from('student_custom_tasks').insert({
      student_id: modalStudent.id,
      target_date: customTaskDate,
      title: newTaskTitle.trim(),
    })
    setNewTaskTitle('')
    await fetchCustomTasks(modalStudent.id, customTaskDate)
    setAddingTask(false)
  }

  const deleteCustomTask = async (taskId) => {
    await supabase.from('student_custom_tasks').delete().eq('id', taskId)
    await fetchCustomTasks(modalStudent.id, customTaskDate)
  }

  const lateJoiners = students.filter((s) => s.is_late_joiner)

  const openBulkModal = () => {
    const todayStr = new Date().toLocaleDateString('en-CA')
    setBulkDate(todayStr)
    setBulkTitles([])
    setBulkInput('')
    setBulkTrack('')
    setBulkCohort('')
    setBulkSelected(lateJoiners.map((s) => s.id))
    setBulkModal(true)
  }

  const addBulkTitle = () => {
    if (!bulkInput.trim()) return
    setBulkTitles((prev) => [...prev, bulkInput.trim()])
    setBulkInput('')
  }

  const removeBulkTitle = (idx) => {
    setBulkTitles((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleBulkStudent = (id) => {
    setBulkSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  const applyBulk = async () => {
    if (bulkSelected.length === 0 || bulkTitles.length === 0) return
    setBulkSaving(true)
    const rows = bulkSelected.flatMap((studentId) =>
      bulkTitles.map((title) => ({ student_id: studentId, target_date: bulkDate, title }))
    )
    await supabase.from('student_custom_tasks').insert(rows)
    setBulkSaving(false)
    setBulkModal(false)
  }

  const filtered = students.filter((s) => {
    if (filterTrack && s.track !== filterTrack) return false
    if (filterCohort && s.cohort !== filterCohort) return false
    return true
  })

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-5 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="text"
          placeholder="트랙"
          value={form.track}
          onChange={(e) => setForm({ ...form, track: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="text"
          placeholder="기수"
          value={form.cohort}
          onChange={(e) => setForm({ ...form, cohort: e.target.value })}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
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

      {lateJoiners.length > 0 && filterTrack && filterCohort && (
        <div className="flex items-center justify-between bg-orange-900/20 border border-orange-700/40 rounded-2xl px-5 py-3">
          <div>
            <p className="text-orange-300 text-sm font-semibold">중간 합류자 {lateJoiners.length}명</p>
            <p className="text-orange-400/70 text-xs mt-0.5">추가 할 일을 전원에게 한 번에 배정할 수 있습니다</p>
          </div>
          <button
            onClick={openBulkModal}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl px-4 py-2 transition flex-shrink-0"
          >
            일괄 추가
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <select
          value={filterTrack}
          onChange={(e) => setFilterTrack(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">전체 트랙</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterCohort}
          onChange={(e) => setFilterCohort(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">전체 기수</option>
          {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {(!filterTrack || !filterCohort) ? (
        <div className="bg-gray-800 rounded-2xl px-6 py-10 text-center text-gray-500 text-sm">
          트랙과 기수를 선택하면 수강생 명단이 표시됩니다
        </div>
      ) : null}

      <div className={`bg-gray-800 rounded-2xl overflow-x-auto ${(!filterTrack || !filterCohort) ? 'hidden' : ''}`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">이름</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">트랙</th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">기수</th>
              <th className="text-center px-4 py-3 text-gray-300 font-semibold whitespace-nowrap">중간 합류자</th>
              <th className="px-4 py-3 text-gray-300 font-semibold text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className={`border-t border-gray-700 ${s.is_late_joiner ? 'bg-orange-900/10' : ''}`}>
                <td className="px-4 py-3 text-white">
                  <div className="flex items-center gap-2">
                    {s.name}
                    {s.is_late_joiner && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-semibold">
                        중간합류
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{s.track}</td>
                <td className="px-4 py-3 text-gray-300">{s.cohort}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      onClick={() => toggleLateJoiner(s)}
                      className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 ${s.is_late_joiner ? 'bg-orange-500' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.is_late_joiner ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    {s.is_late_joiner && (
                      <input
                        type="date"
                        value={s.join_date || ''}
                        onChange={(e) => updateJoinDate(s.id, e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                        title="합류 일자"
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {s.is_late_joiner && (
                    <button
                      onClick={() => openModal(s)}
                      className="text-orange-400 hover:text-orange-300 text-xs border border-orange-700 rounded px-2 py-1"
                    >
                      추가 할 일
                    </button>
                  )}
                  <button onClick={() => handleEdit(s)} className="text-blue-400 hover:text-blue-300 text-xs border border-blue-600 rounded px-2 py-1">수정</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 text-xs border border-red-700 rounded px-2 py-1">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 일괄 추가 모달 */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div>
                <h3 className="text-white font-bold">중간 합류자 일괄 추가</h3>
                <p className="text-gray-400 text-xs mt-0.5">선택한 수강생 전원에게 동일한 할 일을 배정합니다</p>
              </div>
              <button onClick={() => setBulkModal(false)} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 날짜 */}
              <div className="flex items-center gap-3">
                <label className="text-gray-400 text-sm flex-shrink-0">날짜</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* 트랙/기수 필터 */}
              <div className="flex gap-2">
                <select
                  value={bulkTrack}
                  onChange={(e) => {
                    setBulkTrack(e.target.value)
                    setBulkCohort('')
                    setBulkSelected([])
                  }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">트랙 선택</option>
                  {[...new Set(lateJoiners.map((s) => s.track))].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={bulkCohort}
                  disabled={!bulkTrack}
                  onChange={(e) => {
                    setBulkCohort(e.target.value)
                    const filtered = lateJoiners.filter((s) =>
                      s.track === bulkTrack && s.cohort === e.target.value
                    )
                    setBulkSelected(filtered.map((s) => s.id))
                  }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40"
                >
                  <option value="">기수 선택</option>
                  {[...new Set(lateJoiners.filter((s) => s.track === bulkTrack).map((s) => s.cohort))].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 대상 수강생 - 트랙+기수 선택 후에만 표시 */}
              {bulkTrack && bulkCohort ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">대상 수강생</p>
                    <button
                      onClick={() => {
                        const visible = lateJoiners.filter((s) => s.track === bulkTrack && s.cohort === bulkCohort)
                        const allChecked = visible.every((s) => bulkSelected.includes(s.id))
                        setBulkSelected(allChecked ? [] : visible.map((s) => s.id))
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 transition"
                    >
                      전체 선택/해제
                    </button>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {lateJoiners
                      .filter((s) => s.track === bulkTrack && s.cohort === bulkCohort)
                      .map((s) => (
                        <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bulkSelected.includes(s.id)}
                            onChange={() => toggleBulkStudent(s.id)}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-white text-sm">{s.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-gray-600 text-sm">
                  트랙과 기수를 선택하면 수강생 목록이 표시됩니다
                </div>
              )}

              {/* 할 일 목록 */}
              <div>
                <p className="text-gray-400 text-sm mb-2">추가할 할 일</p>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                  {bulkTitles.length === 0 ? (
                    <p className="text-gray-600 text-xs py-2">아직 추가된 항목이 없습니다</p>
                  ) : (
                    bulkTitles.map((title, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-700 rounded-xl px-4 py-2.5">
                        <span className="flex-1 text-white text-sm">{title}</span>
                        <button
                          onClick={() => removeBulkTitle(idx)}
                          className="text-red-400 hover:text-red-300 flex-shrink-0 transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="할 일 입력 후 Enter"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addBulkTitle() }}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
                  />
                  <button
                    onClick={addBulkTitle}
                    disabled={!bulkInput.trim()}
                    className="bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-xl px-4 py-2 transition disabled:opacity-50 flex-shrink-0"
                  >
                    추가
                  </button>
                </div>
              </div>

              <button
                onClick={applyBulk}
                disabled={bulkSaving || bulkSelected.length === 0 || bulkTitles.length === 0}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition disabled:opacity-50"
              >
                {bulkSaving ? '적용 중...' : `${bulkSelected.length}명에게 ${bulkTitles.length}개 일괄 적용`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 커스텀 할 일 관리 모달 */}
      {modalStudent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div>
                <h3 className="text-white font-bold">{modalStudent.name}님의 추가 할 일</h3>
                <p className="text-gray-400 text-xs mt-0.5">"오늘 꼭 해야 할 일" 항목을 날짜별로 설정합니다</p>
              </div>
              <button
                onClick={() => setModalStudent(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-gray-400 text-sm flex-shrink-0">날짜</label>
                <input
                  type="date"
                  value={customTaskDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customTasks.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center">이 날짜에 등록된 추가 할 일이 없습니다</p>
                ) : (
                  customTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-gray-700 rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-white text-sm">{t.title}</span>
                      <button
                        onClick={() => deleteCustomTask(t.id)}
                        className="text-red-400 hover:text-red-300 flex-shrink-0 transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="할 일 입력 후 Enter"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomTask() }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
                />
                <button
                  onClick={addCustomTask}
                  disabled={addingTask || !newTaskTitle.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl px-4 py-2 transition disabled:opacity-50 flex-shrink-0"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
