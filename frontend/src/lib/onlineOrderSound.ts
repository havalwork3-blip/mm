/** Pleasant storefront order chime via Web Audio (no asset file). */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.22) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

export function playOnlineOrderSound(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime + 0.02
  tone(ctx, 880, t0, 0.18, 0.2)
  tone(ctx, 1108.73, t0 + 0.14, 0.22, 0.18)
  tone(ctx, 1318.51, t0 + 0.28, 0.28, 0.16)
}

export function unlockAudioForNotifications(): void {
  const ctx = getCtx()
  if (ctx?.state === 'suspended') void ctx.resume()
}
