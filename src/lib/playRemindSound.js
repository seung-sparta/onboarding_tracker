export function playRemindSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const doPlay = () => {
      ;[[880, 0, 0.35], [1100, 0.25, 0.35], [1320, 0.5, 0.55]].forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = ctx.currentTime + delay
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.4, t + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + dur)
        osc.start(t)
        osc.stop(t + dur)
      })
    }
    ctx.state === 'suspended' ? ctx.resume().then(doPlay) : doPlay()
  } catch (e) {
    console.warn('알림음 재생 실패:', e)
  }
}
