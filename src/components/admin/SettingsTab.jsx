import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SettingsTab({ admin, setAdmin }) {
  // PIN 변경
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  // 관리자 목록
  const [admins, setAdmins] = useState([])
  const [listLoading, setListLoading] = useState(false)

  // 신규 관리자 등록
  const [newName, setNewName] = useState('')
  const [newAdminPin, setNewAdminPin] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const filterNum = (v) => v.replace(/\D/g, '').slice(0, 6)

  const fetchAdmins = async () => {
    setListLoading(true)
    const { data } = await supabase.from('admins').select('id, name, created_at').order('created_at', { ascending: true })
    if (data) setAdmins(data)
    setListLoading(false)
  }

  useEffect(() => { fetchAdmins() }, [])

  const handlePinChange = async (e) => {
    e.preventDefault()
    setPinError('')
    setPinSuccess('')
    if (currentPin !== admin.pin_code) { setPinError('현재 PIN이 올바르지 않습니다.'); return }
    if (newPin.length !== 6) { setPinError('새 PIN은 6자리여야 합니다.'); return }
    if (newPin !== confirmPin) { setPinError('새 PIN 확인이 일치하지 않습니다.'); return }

    setPinLoading(true)
    const { error } = await supabase.from('admins').update({ pin_code: newPin }).eq('id', admin.id)
    setPinLoading(false)

    if (error) { setPinError('저장 중 오류가 발생했습니다.'); return }
    const updated = { ...admin, pin_code: newPin }
    setAdmin(updated)
    sessionStorage.setItem('admin', JSON.stringify(updated))
    setCurrentPin(''); setNewPin(''); setConfirmPin('')
    setPinSuccess('PIN 코드가 변경되었습니다.')
  }

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    setAddError('')
    setAddSuccess('')
    if (!newName.trim()) { setAddError('이름을 입력해주세요.'); return }
    if (newAdminPin.length !== 6) { setAddError('PIN은 6자리여야 합니다.'); return }

    setAddLoading(true)
    const { error } = await supabase.from('admins').insert({ name: newName.trim(), pin_code: newAdminPin })
    setAddLoading(false)

    if (error) { setAddError('등록 중 오류가 발생했습니다.'); return }
    setNewName(''); setNewAdminPin('')
    setAddSuccess(`'${newName.trim()}' 관리자가 등록되었습니다.`)
    fetchAdmins()
  }

  const handleDeleteAdmin = async (targetId, targetName) => {
    if (!window.confirm(`'${targetName}' 관리자를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('admins').delete().eq('id', targetId)
    if (!error) fetchAdmins()
  }

  const isSuperAdmin = admin.role === 'super'

  return (
    <div className="space-y-8 max-w-2xl">

      {/* 관리자 목록 - 슈퍼 관리자만 */}
      {isSuperAdmin && <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">관리자 목록</h2>
        {listLoading ? (
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3">
                <div>
                  <span className="text-white text-sm font-medium">{a.name}</span>
                  {a.id === admin.id && (
                    <span className="ml-2 text-xs text-purple-400 bg-purple-900/40 px-2 py-0.5 rounded-full">현재 계정</span>
                  )}
                </div>
                {a.id !== admin.id && (
                  <button
                    onClick={() => handleDeleteAdmin(a.id, a.name)}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded-lg px-3 py-1 transition"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* 신규 관리자 등록 - 슈퍼 관리자만 */}
      {isSuperAdmin && <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">신규 관리자 등록</h2>
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">이름</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="관리자 이름"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">초기 PIN (6자리)</label>
            <input
              type="password"
              value={newAdminPin}
              onChange={(e) => setNewAdminPin(filterNum(e.target.value))}
              placeholder="PIN 6자리"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          {addSuccess && <p className="text-green-400 text-sm">{addSuccess}</p>}
          <button
            type="submit"
            disabled={addLoading}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
          >
            {addLoading ? '등록 중...' : '관리자 등록'}
          </button>
        </form>
      </div>}

      {/* PIN 변경 */}
      <div className="bg-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">내 PIN 코드 변경</h2>
        <form onSubmit={handlePinChange} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm block mb-1">현재 PIN</label>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(filterNum(e.target.value))}
              placeholder="현재 PIN 6자리"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">새 PIN</label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(filterNum(e.target.value))}
              placeholder="새 PIN 6자리"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1">새 PIN 확인</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(filterNum(e.target.value))}
              placeholder="새 PIN 6자리 재입력"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
          {pinSuccess && <p className="text-green-400 text-sm">{pinSuccess}</p>}
          <button
            type="submit"
            disabled={pinLoading}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
          >
            {pinLoading ? '저장 중...' : 'PIN 변경'}
          </button>
        </form>
      </div>

    </div>
  )
}
