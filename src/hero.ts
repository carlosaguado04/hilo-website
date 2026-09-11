import {
  MAX_SECONDS,
  MIN_SECONDS,
  SLACK,
  formatLive,
  isSnap,
  secondsFromPull,
} from './duration'
import { RopeSim, type Pt, smoothRopePath } from './rope'
import { drawMark, markMetrics, type MarkParams } from './smile'

const CORAL = '#FF6B5A'
const CORAL_DEEP = '#c94b3e'
const INTRO_MS = 420
const HOME_MS = 320
const DONE_HOLD_MS = 480
const SAG_VISUAL = 240

type Mode = 'idle' | 'pulling' | 'running' | 'done'

type Anim = {
  sag0: number
  sag1: number
  morph0: number
  morph1: number
  t0: number
  dur: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

function pointerIn(root: HTMLElement, e: PointerEvent): Pt {
  const r = root.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

export function mountHero(root: HTMLElement): () => void {
  const canvas = root.querySelector('canvas')
  const hint = root.querySelector<HTMLElement>('[data-hint]')
  const timeEl = root.querySelector<HTMLElement>('[data-time]')
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]')
  if (!(canvas instanceof HTMLCanvasElement)) return () => {}

  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const sim = new RopeSim()
  sim.slack = 1.1
  sim.damping = 0.96
  sim.gravity = 1960
  sim.iterations = 12
  sim.particleCount = 22
  sim.constraintRelax = 1
  sim.tailRelax = 1
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')

  let reduced = motionMq.matches
  let raf = 0
  let lastTs = 0
  let dpr = 1
  let width = 0
  let height = 0
  let mode: Mode = 'idle'
  let grabId: number | null = null
  let duration = MIN_SECONDS
  let endAt = 0
  let remaining = 0
  let sag = 0
  let morph = 0
  let progress = 1
  let anim: Anim | null = null
  let doneAt = 0
  let smileX = 0
  let smileMidY = 0
  let smileSize = 112
  let homeEnd: Pt = { x: 0, y: 0 }
  let hangLen = 240
  let hangNudge = 26
  let idleRest = 160
  let extraFor15 = 280
  let hover = false
  let lastSnap = false
  let grabPoint: Pt | null = null

  const markParams = (): MarkParams => ({ sag, morph, progress })

  const restEnd = (anchor: Pt): Pt => ({
    x: anchor.x + hangNudge,
    y: anchor.y + hangLen,
  })

  const restAt = (anchor: Pt) => {
    homeEnd = restEnd(anchor)
    sim.anchor = { ...anchor }
    sim.farAnchor = { ...homeEnd }
    sim.pinsBothEnds = true
    sim.restLength = idleRest
  }

  const layout = () => {
    const next = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, root.clientWidth)
    const h = Math.max(1, root.clientHeight)
    const resized = w !== width || h !== height || next !== dpr
    width = w
    height = h
    dpr = next
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const mobile = w < 760
    smileSize = mobile ? Math.min(92, w * 0.24) : Math.min(128, w * 0.13)
    smileX = w * 0.5
    smileMidY = mobile ? Math.min(h * 0.36, 220) : h * 0.2
    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    const anchor = { x: smileX, y: metrics.bottomY }
    hangLen = Math.min(mobile ? h * 0.2 : h * 0.24, mobile ? 148 : 188)
    hangNudge = Math.min(28, Math.max(16, w * 0.02))
    homeEnd = restEnd(anchor)
    idleRest = Math.max(48, Math.hypot(homeEnd.x - anchor.x, homeEnd.y - anchor.y) * sim.slack)
    extraFor15 = Math.max(170, Math.min(260, h - anchor.y - 40))
    sim.anchor = anchor

    if (resized && mode !== 'pulling') {
      restAt(anchor)
      sim.poseSagging(anchor, homeEnd)
      sim.restLength = idleRest
    }
  }

  const setReset = (on: boolean) => {
    if (!reset) return
    reset.hidden = !on
  }

  const snapHome = () => {
    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    restAt({ x: smileX, y: metrics.bottomY })
    sim.poseSagging(sim.anchor, homeEnd)
    sim.restLength = idleRest
  }

  const startAnim = (next: Omit<Anim, 't0'> & { t0?: number }) => {
    if (reduced) {
      sag = next.sag1
      morph = next.morph1
      anim = null
      return
    }
    anim = { ...next, t0: performance.now() }
  }

  const goIdle = () => {
    mode = 'idle'
    duration = MIN_SECONDS
    remaining = 0
    progress = 1
    endAt = 0
    startAnim({ sag0: sag, sag1: 0, morph0: morph, morph1: 0, dur: HOME_MS })
    snapHome()
    setReset(false)
  }

  const release = () => {
    if (mode !== 'pulling') return
    grabId = null
    mode = 'running'
    remaining = duration
    endAt = performance.now() + duration * 1000
    progress = 1
    startAnim({ sag0: sag, sag1: 0, morph0: morph, morph1: 1, dur: INTRO_MS })
    grabPoint = null
    setReset(true)
  }

  const grabAt = (point: Pt) => {
    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    const floor = metrics.bottomY + SLACK
    const end = {
      x: point.x,
      y: Math.min(height - 18, Math.max(floor, point.y)),
    }
    sim.anchor = { x: smileX, y: metrics.bottomY }
    sim.farAnchor = { ...end }
    sim.pinsBothEnds = true
    const span = Math.hypot(end.x - sim.anchor.x, end.y - sim.anchor.y)
    const extra = Math.max(0, span - SLACK)
    sim.restLength = Math.max(40, span * sim.slack)
    grabPoint = end
    sag = Math.min(1, extra / SAG_VISUAL)
    morph = 0
    progress = 1
    duration = secondsFromPull(SLACK + extra, extraFor15)
    duration = Math.min(duration, MAX_SECONDS)
    remaining = duration
    lastSnap = isSnap(duration)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = pointerIn(root, e)
    const nearSmile = Math.hypot(p.x - smileX, p.y - smileMidY) <= smileSize * 0.72
    const ropeOut = mode === 'pulling'
    const near = nearSmile || (ropeOut && (sim.hitsBead(p, 28) || sim.hits(p, 10)))
    if (!near) return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    grabId = e.pointerId
    mode = 'pulling'
    anim = null
    setReset(true)
    grabAt(p)
    if (grabPoint) {
      sim.layoutChord(sim.anchor, grabPoint)
      sim.restLength = Math.max(
        40,
        Math.hypot(grabPoint.x - sim.anchor.x, grabPoint.y - sim.anchor.y) * sim.slack,
      )
      sim.pinsBothEnds = true
      sim.farAnchor = { ...grabPoint }
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const p = pointerIn(root, e)
    const nearSmile = Math.hypot(p.x - smileX, p.y - smileMidY) <= smileSize * 0.72
    hover = nearSmile || (mode === 'pulling' && (sim.hitsBead(p, 26) || sim.hits(p, 8)))
    if (grabId === e.pointerId && mode === 'pulling') {
      e.preventDefault()
      grabAt(p)
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (grabId !== e.pointerId) return
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    grabId = null
    release()
  }

  const onReset = () => {
    grabId = null
    grabPoint = null
    goIdle()
  }

  const tickAnim = (now: number) => {
    if (!anim) return
    const t = easeOut((now - anim.t0) / anim.dur)
    sag = lerp(anim.sag0, anim.sag1, t)
    morph = lerp(anim.morph0, anim.morph1, t)
    if (t >= 1) {
      sag = anim.sag1
      morph = anim.morph1
      anim = null
    }
  }

  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    const params = markParams()
    const metrics = drawMark(ctx, smileX, smileMidY, smileSize, params, CORAL)
    sim.anchor = { x: smileX, y: metrics.bottomY }
    if (sim.particles.length) {
      sim.particles[0] = { ...sim.anchor }
      sim.previous[0] = { ...sim.anchor }
    }

    const showRope = mode === 'pulling' && sim.particles.length >= 2
    if (showRope) {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      smoothRopePath(ctx, sim.particles)
      ctx.strokeStyle = CORAL_DEEP
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 3.2
      ctx.stroke()
      smoothRopePath(ctx, sim.particles)
      ctx.strokeStyle = CORAL
      ctx.globalAlpha = 1
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      const bead = sim.end
      const r = 7.2
      ctx.save()
      ctx.beginPath()
      ctx.fillStyle = 'rgba(12, 13, 16, 0.35)'
      ctx.arc(bead.x, bead.y + 0.6, r + 1.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = CORAL
      ctx.arc(bead.x, bead.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.arc(bead.x - 1.6, bead.y - 2.1, r * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const showTime = mode === 'pulling' || mode === 'running' || mode === 'done'
    if (timeEl) {
      if (showTime) {
        const value = mode === 'pulling' ? duration : remaining
        timeEl.textContent = formatLive(value)
        timeEl.dataset.snap = isSnap(mode === 'pulling' ? duration : 0) ? '1' : '0'
        timeEl.hidden = false
        if (showRope) {
          const bead = sim.end
          const onRight = bead.x < width - 88
          timeEl.style.left = `${onRight ? bead.x + 14 : bead.x - 14}px`
          timeEl.style.top = `${bead.y}px`
          timeEl.style.transform = onRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)'
        } else {
          timeEl.style.left = `${smileX}px`
          timeEl.style.top = `${smileMidY + smileSize * 0.62}px`
          timeEl.style.transform = 'translate(-50%, 0)'
        }
      } else {
        timeEl.hidden = true
        timeEl.textContent = ''
      }
    }

    if (hint) {
      const showHint = mode === 'idle'
      hint.hidden = !showHint
      if (showHint) {
        hint.style.left = `${smileX}px`
        hint.style.top = `${smileMidY + smileSize * 0.58}px`
      }
    }

    canvas.style.cursor = mode === 'pulling' ? 'grabbing' : hover ? 'grab' : 'default'
    root.classList.toggle('is-pulling', mode === 'pulling')
    root.classList.toggle('is-running', mode === 'running')
    root.classList.toggle('is-snapped', lastSnap && mode === 'pulling')
  }

  const frame = () => {
    const now = performance.now()
    const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 1 / 60
    lastTs = now
    tickAnim(now)

    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    sim.anchor = { x: smileX, y: metrics.bottomY }
    const bounds = { width, height }

    if (mode === 'running') {
      remaining = Math.max(0, (endAt - now) / 1000)
      progress = duration > 0 ? remaining / duration : 0
      if (remaining <= 0) {
        remaining = 0
        progress = 0
        mode = 'done'
        doneAt = now
      }
    } else if (mode === 'done') {
      remaining = 0
      progress = 0
      if (now - doneAt > DONE_HOLD_MS) goIdle()
    } else if (mode === 'idle') {
      progress = 1
    }

    if (mode === 'pulling' && grabPoint) {
      sim.pinsBothEnds = true
      sim.farAnchor = { ...grabPoint }
      const span = Math.hypot(grabPoint.x - sim.anchor.x, grabPoint.y - sim.anchor.y)
      sim.restLength = Math.max(40, span * sim.slack)
      if (reduced) {
        sim.layoutChord(sim.anchor, grabPoint)
      } else {
        sim.step(dt, bounds)
        sim.pinEnds()
        sim.clampInteriorY(grabPoint.y)
      }
    }

    draw()
    raf = requestAnimationFrame(frame)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && mode !== 'idle') {
      e.preventDefault()
      onReset()
    }
  }

  const onMotion = () => {
    reduced = motionMq.matches
    document.documentElement.classList.toggle('reduced-motion', reduced)
    if (reduced && mode !== 'pulling') snapHome()
  }

  const ro = new ResizeObserver(() => layout())
  ro.observe(root)
  layout()
  if (sim.particles.length < 2) {
    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    sim.reset({ x: smileX, y: metrics.bottomY }, homeEnd)
    sim.restLength = idleRest
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('lostpointercapture', () => {
    if (mode === 'pulling') release()
  })
  reset?.addEventListener('click', onReset)
  window.addEventListener('keydown', onKey)
  motionMq.addEventListener('change', onMotion)
  onMotion()
  setReset(false)
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    reset?.removeEventListener('click', onReset)
    window.removeEventListener('keydown', onKey)
    motionMq.removeEventListener('change', onMotion)
  }
}
