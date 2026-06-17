import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Confetti from 'react-confetti'
import { supabase } from '../lib/supabase'
import Planner from '../components/Planner'

export default function StudentMain() {
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [tasks, setTasks] = useState([])
  const [customTasks, setCustomTasks] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showCheer, setShowCheer] = useState(false)
  const [cheerKey, setCheerKey] = useState(0)
  const [cheerMessage, setCheerMessage] = useState('')
  const [allDone, setAllDone] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [savedPlan, setSavedPlan] = useState(null)
  const [taskOrder, setTaskOrder] = useState([])
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [showExitModal, setShowExitModal] = useState(false)
  const exitModalShownRef = useRef(false)
  const cheerTimeoutRef = useRef(null)

  const SLOTS = Array.from({ length: 12 }, (_, i) => {
    const total = 10 * 60 + i * 30
    const h = Math.floor(total / 60)
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })

  // 최신 student 데이터 fetch (is_late_joiner 등 반영)
  useEffect(() => {
    const stored = sessionStorage.getItem('student')
    if (!stored) {
      navigate('/')
      return
    }
    const storedData = JSON.parse(stored)
    supabase.from('students').select('*').eq('id', storedData.id).single().then(({ data }) => {
      const latest = data || storedData
      setStudent(latest)
      sessionStorage.setItem('student', JSON.stringify(latest))

      const planKey = `plan_${latest.id}_${new Date().toLocaleDateString('en-CA')}`
      const saved = localStorage.getItem(planKey)
      if (saved) setSavedPlan(JSON.parse(saved))
    })
  }, [navigate])

  const fetchData = useCallback(async (studentData) => {
    const today = new Date().toLocaleDateString('en-CA')

    const [{ data: taskData }, { data: customTaskData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('target_date', today).order('day_number', { ascending: true }),
      studentData.is_late_joiner
        ? supabase.from('student_custom_tasks').select('*').eq('student_id', studentData.id).eq('target_date', today).order('created_at')
        : Promise.resolve({ data: [] }),
    ])

    setTasks(taskData || [])
    setCustomTasks(customTaskData || [])

    if (taskData && taskData.length > 0) {
      const { data: progressData } = await supabase
        .from('progress')
        .select('*')
        .eq('student_id', studentData.id)
        .in('task_id', taskData.map((t) => t.id))

      const progressMap = {}
      if (progressData) {
        progressData.forEach((p) => { progressMap[p.task_id] = p })
      }
      setProgress(progressMap)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (student) {
      fetchData(student)
      supabase
        .from('class_schedules')
        .select('*')
        .eq('track', student.track)
        .eq('cohort', student.cohort)
        .single()
        .then(({ data }) => { if (data) setSchedule(data) })
    }
  }, [student, fetchData])

  useEffect(() => {
    if (!schedule) return
    const calc = () => {
      const now = new Date()
      const [endH, endM] = schedule.end_time.slice(0, 5).split(':').map(Number)
      const end = new Date()
      end.setHours(endH, endM, 0, 0)
      const diff = end - now
      if (diff <= 0) {
        setTimeLeft({ done: true })
        if (!exitModalShownRef.current) {
          exitModalShownRef.current = true
          setShowExitModal(true)
        }
        return
      }
      setTimeLeft({
        done: false,
        hours: Math.floor(diff / 1000 / 60 / 60),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [schedule])

  useEffect(() => {
    const commonDone = tasks.filter((t) => progress[t.id]?.is_completed).length
    const customDone = customTasks.filter((t) => t.is_completed).length
    const total = tasks.length + customTasks.length
    setAllDone(total > 0 && commonDone + customDone === total)
  }, [tasks, progress, customTasks])

  useEffect(() => {
    if (tasks.length === 0 || !student) return
    const orderKey = `taskOrder_${student.id}_${new Date().toLocaleDateString('en-CA')}`
    const saved = localStorage.getItem(orderKey)
    if (saved) {
      const savedOrder = JSON.parse(saved)
      const taskIds = tasks.map((t) => t.id)
      const merged = savedOrder.filter((id) => taskIds.includes(id))
      const newIds = taskIds.filter((id) => !merged.includes(id))
      setTaskOrder([...merged, ...newIds])
    } else {
      setTaskOrder(tasks.map((t) => t.id))
    }
  }, [tasks, student])

  const triggerCheer = (message) => {
    setCheerMessage(message)
    if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current)
    setShowCheer(false)
    setTimeout(() => {
      setCheerKey((k) => k + 1)
      setShowCheer(true)
      cheerTimeoutRef.current = setTimeout(() => setShowCheer(false), 3000)
    }, 0)
  }

  const handleTaskDragStart = (e, id) => {
    setDraggingTaskId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleTaskDragOver = (e, id) => {
    e.preventDefault()
    if (id !== draggingTaskId) setDragOverTaskId(id)
  }

  const handleTaskDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggingTaskId || draggingTaskId === targetId) return
    const newOrder = [...taskOrder]
    const fromIdx = newOrder.indexOf(draggingTaskId)
    const toIdx = newOrder.indexOf(targetId)
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, draggingTaskId)
    setTaskOrder(newOrder)
    const orderKey = `taskOrder_${student.id}_${new Date().toLocaleDateString('en-CA')}`
    localStorage.setItem(orderKey, JSON.stringify(newOrder))
    setDraggingTaskId(null)
    setDragOverTaskId(null)
  }

  const handleTaskDragEnd = () => {
    setDraggingTaskId(null)
    setDragOverTaskId(null)
  }

  const toggleTask = async (taskId) => {
    if (!student) return
    const current = progress[taskId]
    const newCompleted = !current?.is_completed

    const { error } = await supabase
      .from('progress')
      .upsert(
        {
          student_id: student.id,
          task_id: taskId,
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        },
        { onConflict: 'student_id,task_id' }
      )

    if (!error) {
      const newProgress = { ...progress, [taskId]: { ...progress[taskId], is_completed: newCompleted } }
      setProgress(newProgress)

      if (newCompleted) {
        const commonDone = tasks.filter((t) => (t.id === taskId ? true : newProgress[t.id]?.is_completed)).length
        const customDone = customTasks.filter((t) => t.is_completed).length
        const total = tasks.length + customTasks.length

        if (commonDone + customDone === total) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 5000)
        } else {
          triggerCheer('할 일 1건 완료! 수고했어요!')
        }
      }
    }
  }

  const toggleCustomTask = async (customTask) => {
    const newCompleted = !customTask.is_completed
    const { error } = await supabase
      .from('student_custom_tasks')
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', customTask.id)

    if (!error) {
      const newCustomTasks = customTasks.map((t) =>
        t.id === customTask.id ? { ...t, is_completed: newCompleted } : t
      )
      setCustomTasks(newCustomTasks)

      if (newCompleted) {
        const commonDone = tasks.filter((t) => progress[t.id]?.is_completed).length
        const customDone = newCustomTasks.filter((t) => t.is_completed).length
        const total = tasks.length + newCustomTasks.length

        if (commonDone + customDone === total) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 5000)
        } else {
          triggerCheer('할 일 1건 완료! 수고했어요!')
        }
      }
    }
  }

  const commonCompletedCount = tasks.filter((t) => progress[t.id]?.is_completed).length
  const customCompletedCount = customTasks.filter((t) => t.is_completed).length
  const completedCount = commonCompletedCount + customCompletedCount
  const totalCount = tasks.length + customTasks.length
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  if (!student) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={400}
        />
      )}

      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm px-6 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <img src="/check-ltani.png" alt="르탄이" className="w-16 h-16 object-contain flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-700">{student.name}님의 오늘 달성률</p>
              {timeLeft && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  timeLeft.done
                    ? 'bg-gray-100 text-gray-400'
                    : timeLeft.hours === 0 && timeLeft.minutes < 30
                    ? 'bg-red-50 text-red-500'
                    : 'bg-purple-50 text-purple-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {timeLeft.done
                    ? '퇴실 시간 완료'
                    : `퇴실까지 ${timeLeft.hours > 0 ? `${timeLeft.hours}시간 ` : ''}${timeLeft.minutes}분 ${timeLeft.seconds}초`}
                </div>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-right text-xs text-purple-600 font-bold mt-0.5">{percent}%</p>
          </div>
        </div>
      </div>

      {/* 메인 카드 */}
      <div className="flex justify-center px-4 py-8">
        <div className={`bg-white rounded-3xl shadow-2xl p-8 w-full flex gap-8 transition-all duration-500 ${savedPlan && Object.keys(savedPlan).length > 0 ? 'max-w-4xl' : 'max-w-lg'}`}>

          {/* 할 일 목록 */}
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-sm mb-1">{todayStr}</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">오늘의 할 일</h2>
            <p className="text-gray-500 text-sm mb-6">{completedCount}/{totalCount} 완료</p>

            {loading ? (
              <p className="text-center text-gray-400 py-8">불러오는 중...</p>
            ) : tasks.length === 0 && customTasks.length === 0 ? (
              <p className="text-center text-gray-400 py-8">오늘 등록된 할 일이 없습니다.</p>
            ) : (
              <>
                {/* 공통 할 일 */}
                {tasks.length > 0 && (
                  <ul className="space-y-3">
                    {taskOrder.map((id) => {
                      const task = tasks.find((t) => t.id === id)
                      if (!task) return null
                      const done = progress[task.id]?.is_completed
                      const isDragging = draggingTaskId === task.id
                      const isOver = dragOverTaskId === task.id
                      return (
                        <li
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleTaskDragStart(e, task.id)}
                          onDragOver={(e) => handleTaskDragOver(e, task.id)}
                          onDrop={(e) => handleTaskDrop(e, task.id)}
                          onDragEnd={handleTaskDragEnd}
                          onClick={() => toggleTask(task.id)}
                          className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all select-none ${
                            isDragging ? 'opacity-40' : ''
                          } ${
                            isOver
                              ? 'border-2 border-purple-400 bg-purple-50'
                              : done
                              ? 'bg-purple-50 border border-purple-200'
                              : 'bg-white border border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="text-gray-300 hover:text-gray-400 cursor-grab flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                              <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                            </svg>
                          </div>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-purple-500' : 'border-2 border-gray-300'}`}>
                            {done && (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`flex-1 text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {task.title}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* 중간 합류자 추가 할 일 섹션 */}
                {customTasks.length > 0 && (
                  <div className={`${tasks.length > 0 ? 'mt-6 pt-6 border-t-2 border-dashed border-orange-200' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                      <h3 className="font-bold text-gray-800 text-sm">오늘 꼭 해야 할 일</h3>
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold ml-auto">
                        {customCompletedCount}/{customTasks.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {customTasks.map((task) => {
                        const done = task.is_completed
                        return (
                          <li
                            key={task.id}
                            onClick={() => toggleCustomTask(task)}
                            className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all select-none ${
                              done
                                ? 'bg-orange-50 border border-orange-200'
                                : 'bg-white border border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-orange-400' : 'border-2 border-gray-300'}`}>
                              {done && (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`flex-1 text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {task.title}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}

            {allDone && totalCount > 0 && (
              <div className="mt-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 text-white text-center">
                <p className="font-bold text-lg">모든 할 일을 완료했습니다!</p>
                <p className="text-sm opacity-90 mt-1">정말 수고하셨어요!</p>
              </div>
            )}

            {tasks.length > 0 && (
              <button
                onClick={() => setShowPlanner(true)}
                className="mt-4 w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 text-purple-500 font-semibold text-sm hover:bg-purple-50 hover:border-purple-400 transition"
              >
                나만의 계획 세우기
              </button>
            )}
          </div>

          {/* 타임라인 (저장 후에만 표시) */}
          {savedPlan && Object.keys(savedPlan).length > 0 && (
            <div className="w-56 flex-shrink-0 border-l border-gray-100 pl-8">
              <h3 className="text-lg font-bold text-gray-800 mb-1">오늘의 타임라인</h3>
              <p className="text-gray-400 text-xs mb-4">나만의 하루 계획</p>
              <div className="space-y-1">
                {SLOTS.map((slot) => {
                  const taskIds = Array.isArray(savedPlan[slot])
                    ? savedPlan[slot]
                    : savedPlan[slot] ? [savedPlan[slot]] : []
                  return (
                    <div key={slot} className="flex items-start gap-2">
                      <span className="text-gray-400 text-xs w-11 flex-shrink-0 pt-1 font-mono">{slot}</span>
                      <div className="flex-1 space-y-0.5 min-h-[24px]">
                        {taskIds.map((taskId) => {
                          const task = tasks.find((t) => t.id === taskId)
                          if (!task) return null
                          const done = progress[task.id]?.is_completed
                          return (
                            <div key={taskId} className={`rounded-lg px-2 py-1 text-xs ${
                              done
                                ? 'bg-purple-50 text-gray-400 line-through'
                                : 'bg-purple-100 text-purple-800 font-medium'
                            }`}>
                              {task.title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-gray-400 text-xs w-11 font-mono">16:00</span>
                  <div className="flex-1 border-t border-gray-100" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm text-center overflow-hidden">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 pt-8 pb-4 flex justify-center">
              <img src="/expect-ltani.png" alt="르탄이" className="w-36 h-36 object-contain" />
            </div>
            <div className="px-8 py-6">
              <p className="text-lg font-bold text-gray-800 leading-relaxed mb-6">
                퇴실 시간이 되었습니다!<br />
                오늘 하루는 어떠셨나요~?<br />
                <span className="text-purple-600">푹 쉬시고 내일 또 힘차게 달려보아요!</span>
              </p>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanner && student && (
        <Planner
          tasks={tasks}
          customTasks={customTasks}
          studentId={student.id}
          onClose={() => setShowPlanner(false)}
          onSave={(plan) => setSavedPlan(plan)}
        />
      )}

      {showCheer && (
        <div
          key={cheerKey}
          className="fixed bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-50"
          style={{ animation: 'cheerUp 3s ease-out forwards' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl px-6 py-3 mb-2 text-center">
            <p className="font-bold text-gray-800">{cheerMessage}</p>
          </div>
          <img src="/cheer-ltani.png" alt="축하" className="w-32 h-32 object-contain" />
        </div>
      )}

      <style>{`
        @keyframes cheerUp {
          0% { transform: translateX(-50%) translateY(100%); opacity: 0; }
          20% { transform: translateX(-50%) translateY(0); opacity: 1; }
          70% { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
