import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const emptyForm = { day_number: 1, title: '' }

export default function TaskTab() {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [filterDay, setFilterDay] = useState('')
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

  const fetchTasks = useCallback(async () => {
    if (!selectedTrack || !selectedCohort) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('track', selectedTrack)
      .eq('cohort', selectedCohort)
      .order('day_number')
      .order('created_at')
    if (data) setTasks(data)
  }, [selectedTrack, selectedCohort])

  useEffect(() => {
    setTasks([])
    setFilterDay('')
    setForm(emptyForm)
    setEditId(null)
    fetchTasks()
  }, [fetchTasks])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !selectedTrack || !selectedCohort) return

    if (editId) {
      await supabase.from('tasks').update({ day_number: form.day_number, title: form.title }).eq('id', editId)
    } else {
      await supabase.from('tasks').insert({
        day_number: form.day_number,
        title: form.title,
        track: selectedTrack,
        cohort: selectedCohort,
      })
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

  const fileInputRef = useRef(null)
  const [xlsxModal, setXlsxModal] = useState(false)
  const [xlsxRows, setXlsxRows] = useState([])
  const [xlsxUploading, setXlsxUploading] = useState(false)
  const [xlsxResult, setXlsxResult] = useState(null)

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Day', '할 일'],
      [1, '스파르타 코딩클럽 가입하기'],
      [1, '노션 페이지 확인하기'],
      [2, '깃허브 계정 만들기'],
    ])
    ws['!cols'] = [{ wch: 8 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '할 일')
    XLSX.writeFile(wb, `할 일_업로드_템플릿.xlsx`)
  }

  const handleXlsxFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (raw.length < 2) { alert('데이터가 없습니다.'); return }

      const header = raw[0].map((h) => String(h).trim())
      const dayIdx = header.findIndex((h) => h === 'Day' || h === 'day' || h === 'DAY')
      const titleIdx = header.findIndex((h) => h === '할 일')

      if (dayIdx === -1 || titleIdx === -1) {
        alert('열 이름이 올바르지 않습니다.\n첫 행에 "Day", "할 일" 열이 있어야 합니다.')
        return
      }

      const rows = raw.slice(1).map((row, i) => {
        const rawDay = String(row[dayIdx] ?? '').trim()
        const title = String(row[titleIdx] ?? '').trim()
        const day_number = parseInt(rawDay)
        const errors = []
        if (!rawDay || isNaN(day_number) || day_number < 1) errors.push('Day 오류')
        if (!title) errors.push('할 일 없음')
        return { _row: i + 2, day_number: isNaN(day_number) ? '' : day_number, title, errors }
      }).filter((r) => r.day_number !== '' || r.title)

      setXlsxRows(rows)
      setXlsxResult(null)
      setXlsxModal(true)
    }
    reader.readAsArrayBuffer(file)
  }

  const applyXlsx = async () => {
    const valid = xlsxRows.filter((r) => r.errors.length === 0)
    if (valid.length === 0) return
    setXlsxUploading(true)
    const { error } = await supabase.from('tasks').insert(
      valid.map(({ day_number, title }) => ({
        day_number, title, track: selectedTrack, cohort: selectedCohort,
      }))
    )
    setXlsxUploading(false)
    if (error) {
      setXlsxResult({ success: false, message: error.message })
    } else {
      setXlsxResult({ success: true, count: valid.length })
      fetchTasks()
    }
  }

  const days = [...new Set(tasks.map((t) => t.day_number))].sort((a, b) => a - b)
  const filtered = filterDay ? tasks.filter((t) => t.day_number === parseInt(filterDay)) : tasks
  const isReady = selectedTrack && selectedCohort

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleXlsxFile} />
      {/* 트랙·기수 선택 */}
      <div className="flex gap-3 flex-wrap">
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
          <span className="flex items-center text-xs text-purple-400 bg-purple-900/30 px-3 py-1.5 rounded-xl font-semibold">
            {selectedTrack} · {selectedCohort} 할 일
          </span>
        )}
      </div>

      {!isReady ? (
        <div className="bg-gray-800 rounded-2xl px-6 py-10 text-center text-gray-500 text-sm">
          트랙과 기수를 선택하면 할 일이 표시됩니다
        </div>
      ) : (
        <>
          {/* 추가/수정 폼 */}
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
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={downloadTemplate}
                className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-semibold rounded-xl px-4 py-2 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                템플릿 다운로드
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl px-4 py-2 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                엑셀 업로드
              </button>
            </div>
          </form>

          {/* Day 필터 */}
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

          {/* 할 일 목록 */}
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      등록된 할 일이 없습니다
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 엑셀 업로드 미리보기 모달 */}
      {xlsxModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-700 flex-shrink-0">
              <div>
                <h3 className="text-white font-bold">할 일 엑셀 업로드 미리보기</h3>
                <p className="text-gray-400 text-xs mt-0.5">
                  {selectedTrack} · {selectedCohort} &nbsp;|&nbsp;
                  총 {xlsxRows.length}행 / 유효 {xlsxRows.filter((r) => r.errors.length === 0).length}개 /
                  오류 {xlsxRows.filter((r) => r.errors.length > 0).length}행
                </p>
              </div>
              <button onClick={() => setXlsxModal(false)} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {xlsxResult ? (
                <div className={`rounded-xl p-5 text-center ${xlsxResult.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                  {xlsxResult.success ? (
                    <>
                      <p className="text-green-300 font-bold text-lg">{xlsxResult.count}개 할 일 등록 완료</p>
                      <button
                        onClick={() => setXlsxModal(false)}
                        className="mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl px-6 py-2 transition"
                      >
                        닫기
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-red-300 font-bold">오류 발생</p>
                      <p className="text-red-400 text-sm mt-1">{xlsxResult.message}</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 mb-3">빨간 행은 오류로 제외됩니다</div>
                  <div className="rounded-xl overflow-hidden border border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-300 font-semibold">행</th>
                          <th className="text-left px-3 py-2 text-gray-300 font-semibold">Day</th>
                          <th className="text-left px-3 py-2 text-gray-300 font-semibold">할 일</th>
                          <th className="text-left px-3 py-2 text-gray-300 font-semibold">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xlsxRows.map((row) => (
                          <tr key={row._row} className={`border-t border-gray-700 ${row.errors.length > 0 ? 'bg-red-900/20' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{row._row}</td>
                            <td className="px-3 py-2">
                              {row.day_number !== ''
                                ? <span className="bg-purple-900/50 text-purple-300 rounded text-xs px-2 py-1">Day {row.day_number}</span>
                                : <span className="text-red-400 italic text-xs">없음</span>}
                            </td>
                            <td className="px-3 py-2 text-white">{row.title || <span className="text-red-400 italic text-xs">없음</span>}</td>
                            <td className="px-3 py-2">
                              {row.errors.length === 0
                                ? <span className="text-green-400 text-xs">정상</span>
                                : <span className="text-red-400 text-xs">{row.errors.join(', ')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {!xlsxResult && (
              <div className="p-5 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={applyXlsx}
                  disabled={xlsxUploading || xlsxRows.filter((r) => r.errors.length === 0).length === 0}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition disabled:opacity-50"
                >
                  {xlsxUploading
                    ? '등록 중...'
                    : `유효한 ${xlsxRows.filter((r) => r.errors.length === 0).length}개 등록`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
