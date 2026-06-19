import { useState } from 'react'

const SLOTS = Array.from({ length: 12 }, (_, i) => {
  const total = 10 * 60 + i * 30
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export default function Planner({ tasks, customTasks = [], studentId, onClose, onSave }) {
  const storageKey = `plan_${studentId}_${new Date().toLocaleDateString('en-CA')}`

  const [plan, setPlan] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return {}
    const parsed = JSON.parse(saved)
    const migrated = {}
    Object.entries(parsed).forEach(([slot, val]) => {
      migrated[slot] = Array.isArray(val) ? val : [val]
    })
    return migrated
  })
  const [draggingTask, setDraggingTask] = useState(null)
  const [draggingFrom, setDraggingFrom] = useState(null)
  const [dragOverSlot, setDragOverSlot] = useState(null)

  const allTasks = [...tasks, ...customTasks]
  const isCustomTask = (id) => customTasks.some((t) => t.id === id)

  const savePlan = (newPlan) => {
    setPlan(newPlan)
    localStorage.setItem(storageKey, JSON.stringify(newPlan))
  }

  const placedTaskIds = new Set(Object.values(plan).flat())
  const unplacedCommon = tasks.filter((t) => !placedTaskIds.has(t.id))
  const unplacedCustom = customTasks.filter((t) => !placedTaskIds.has(t.id))
  const getTaskById = (id) => allTasks.find((t) => t.id === id)

  const handleDragStart = (taskId, from) => {
    setDraggingTask(taskId)
    setDraggingFrom(from)
  }

  const handleDropOnSlot = (slot) => {
    if (!draggingTask) return
    const newPlan = { ...plan }

    if (draggingFrom !== 'list') {
      newPlan[draggingFrom] = (newPlan[draggingFrom] || []).filter((id) => id !== draggingTask)
      if (newPlan[draggingFrom].length === 0) delete newPlan[draggingFrom]
    }

    const current = newPlan[slot] || []
    if (!current.includes(draggingTask)) {
      newPlan[slot] = [...current, draggingTask]
    }

    savePlan(newPlan)
    setDraggingTask(null)
    setDraggingFrom(null)
    setDragOverSlot(null)
  }

  const handleDropOnList = () => {
    if (!draggingTask || draggingFrom === 'list') return
    const newPlan = { ...plan }
    newPlan[draggingFrom] = (newPlan[draggingFrom] || []).filter((id) => id !== draggingTask)
    if (newPlan[draggingFrom].length === 0) delete newPlan[draggingFrom]
    savePlan(newPlan)
    setDraggingTask(null)
    setDraggingFrom(null)
  }

  const handleDragOver = (e) => e.preventDefault()
  const clearAll = () => savePlan({})

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-3xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">나만의 계획 세우기</h2>
            <p className="text-xs text-gray-400 mt-0.5">할 일을 드래그해서 원하는 시간에 넣어봐요 (한 슬롯에 여러 개 가능)</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-red-400 transition">
              초기화
            </button>
            <button
              onClick={() => { onSave(plan); onClose() }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-semibold transition"
            >
              저장하기
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 바디 */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">

          {/* 할 일 목록 사이드바 (모바일: 상단 고정, sm+: 우측 사이드바) */}
          <div
            className="order-1 sm:order-2 w-full sm:w-56 border-b sm:border-b-0 sm:border-l border-gray-700 flex flex-col sm:flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={handleDropOnList}
          >
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">할 일 목록</p>
              <p className="text-gray-600 text-xs mt-0.5">타임라인으로 드래그</p>
            </div>
            <div className="overflow-y-auto px-4 pb-4 space-y-2 max-h-36 sm:max-h-none sm:flex-1">
              {unplacedCommon.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id, 'list')}
                  className="bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white cursor-grab active:cursor-grabbing hover:border-purple-500 hover:bg-gray-700 transition select-none"
                >
                  {task.title}
                </div>
              ))}

              {unplacedCustom.length > 0 && (
                <>
                  {unplacedCustom.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id, 'list')}
                      className="bg-orange-900/30 border border-orange-700/50 rounded-xl px-3 py-2.5 text-sm text-white cursor-grab active:cursor-grabbing hover:border-orange-500 hover:bg-orange-900/50 transition select-none"
                    >
                      {task.title}
                    </div>
                  ))}
                </>
              )}

              {unplacedCommon.length === 0 && unplacedCustom.length === 0 && (
                <div className="text-center py-4 sm:py-8">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="text-gray-400 text-xs">모든 할 일을<br />배치했어요!</p>
                </div>
              )}
            </div>
          </div>

          {/* 타임라인 */}
          <div className="order-2 sm:order-1 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              {SLOTS.map((slot) => {
                const taskIds = plan[slot] || []
                const isOver = dragOverSlot === slot

                return (
                  <div key={slot} className="flex items-start gap-3">
                    <span className="text-gray-500 text-xs w-12 flex-shrink-0 text-right font-mono pt-2">
                      {slot}
                    </span>
                    <div
                      className={`flex-1 min-h-[44px] rounded-xl border-2 transition-all ${
                        taskIds.length > 0
                          ? 'border-purple-500 bg-purple-900/40'
                          : isOver
                          ? 'border-purple-400 bg-purple-900/20'
                          : 'border-dashed border-gray-700 hover:border-gray-600'
                      }`}
                      onDragOver={(e) => { handleDragOver(e); setDragOverSlot(slot) }}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={() => handleDropOnSlot(slot)}
                    >
                      {taskIds.length > 0 ? (
                        <div className="p-1.5 space-y-1">
                          {taskIds.map((taskId) => {
                            const task = getTaskById(taskId)
                            if (!task) return null
                            const isCustom = isCustomTask(taskId)
                            return (
                              <div
                                key={taskId}
                                draggable
                                onDragStart={() => handleDragStart(taskId, slot)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition ${
                                  isCustom
                                    ? 'bg-orange-800/60 hover:bg-orange-700/60'
                                    : 'bg-purple-800/60 hover:bg-purple-700/60'
                                }`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCustom ? 'bg-orange-300' : 'bg-purple-300'}`} />
                                <span className="text-sm text-white font-medium">{task.title}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-2 text-xs text-gray-600">
                          {isOver ? '여기에 놓기' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-12 text-right font-mono">16:00</span>
                <div className="flex-1 border-t border-gray-700" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
