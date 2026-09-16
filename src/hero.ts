import {
  MAX_SECONDS,
  MIN_SECONDS,
  SLACK,
  extraForMax,
  formatLive,
  isSnap,
  secondsFromPull,
} from './duration'
import { drawDesktop, drawDock, layoutDock } from './desktop'
import { drawMenuBar, layoutBar } from './menubar'
import { palette } from './site'
import { RopeSim, type Pt, smoothRopePath } from './rope'
import { drawMark, markMetrics, type MarkParams } from './smile'

const INTRO_MS = 420
const HOME_MS = 320
const DONE_HOLD_MS = 720
const SAG_VISUAL = 240
const BOOT_MS = 780

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
  if (!(canvas instanceof HTMLCanvasElement)) return () => {}

  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const sim = new RopeSim()
  sim.slack = 1.22
  sim.damping = 0.96
  sim.gravity = 1960
  sim.iterations = 12
  sim.particleCount = 22
  sim.constraintRelax = 1
  sim.tailRelax = 0.4
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
  let smileSize = 18
  let pullExtra = 360
  let bar = layoutBar(800)
  let dock = layoutDock(800, 500)
  let hover = false
  let cursor: Pt | null = null
  let grabPoint: Pt | null = null
  let booted = reduced
  let bootAt = performance.now()

  const markParams = (): MarkParams => ({ sag, morph, progress })

  const smileAnchor = (): Pt => {
    const metrics = markMetrics(smileX, smileMidY, smileSize, markParams())
    return { x: smileX, y: metrics.bottomY }
  }

  const layout = () => {
    const next = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, root.clientWidth)
    const h = Math.max(1, root.clientHeight)
    width = w
    height = h
    dpr = next
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    bar = layoutBar(w)
    dock = layoutDock(w, h)
    smileSize = bar.smileSize
    smileX = bar.smileX
    smileMidY = bar.smileY
    const anchor = smileAnchor()
    const available = Math.max(80, dock.y - anchor.y - SLACK - 16)
    pullExtra = extraForMax(available)
    sim.anchor = anchor
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

  const clearRope = () => {
    sim.particles = []
    sim.previous = []
    grabPoint = null
  }

  const goIdle = () => {
    mode = 'idle'
    duration = MIN_SECONDS
    remaining = 0
    progress = 1
    endAt = 0
    clearRope()
    startAnim({ sag0: sag, sag1: 0, morph0: morph, morph1: 0, dur: HOME_MS })
  }

  const release = () => {
    if (mode !== 'pulling') return
    grabId = null
    mode = 'running'
    remaining = duration
    endAt = performance.now() + duration * 1000
    progress = 1
    startAnim({ sag0: sag, sag1: 0, morph0: morph, morph1: 1, dur: INTRO_MS })
    clearRope()
  }

  const grabAt = (point: Pt) => {
    const anchor = smileAnchor()
    const floor = anchor.y + SLACK
    const end = {
      x: point.x,
      y: Math.min(dock.y - 12, Math.max(floor, point.y)),
    }
    sim.anchor = { ...anchor }
    sim.farAnchor = { ...end }
    sim.pinsBothEnds = false
    const span = Math.hypot(end.x - anchor.x, end.y - anchor.y)
    sim.restLength = Math.max(40, span * sim.slack)
    grabPoint = end
    sag = Math.min(1, Math.max(0, span - SLACK) / SAG_VISUAL)
    morph = 0
    progress = 1
    duration = Math.min(secondsFromPull(span, pullExtra), MAX_SECONDS)
    remaining = duration
  }

  const nearHandle = (p: Pt): boolean => {
    const nearSmile = Math.hypot(p.x - smileX, p.y - smileMidY) <= Math.max(20, smileSize)
    if (mode !== 'pulling') return nearSmile
    return nearSmile || sim.hitsBead(p, 28) || sim.hits(p, 12)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = pointerIn(root, e)
    if (!nearHandle(p)) return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)
    grabId = e.pointerId
    mode = 'pulling'
    anim = null
    grabAt(p)
    if (grabPoint) {
      sim.layoutChord(sim.anchor, grabPoint)
      sim.placeFreeEnd(grabPoint)
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const p = pointerIn(root, e)
    cursor = p
    hover = nearHandle(p)
    if (grabId === e.pointerId && mode === 'pulling') {
      e.preventDefault()
      grabAt(p)
    }
  }

  const onPointerLeave = () => {
    if (mode !== 'pulling') cursor = null
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

  const syncBar = () => {
    bar = layoutBar(width)
    smileSize = bar.smileSize
    smileX = bar.smileX
    smileMidY = bar.smileY
  }

  const drawRope = () => {
    if (mode !== 'pulling' || sim.particles.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    smoothRopePath(ctx, sim.particles)
    ctx.strokeStyle = palette.acidDeep
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 3.2
    ctx.stroke()
    smoothRopePath(ctx, sim.particles)
    ctx.strokeStyle = palette.acid
    ctx.globalAlpha = 1
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    const bead = sim.end
    const r = 7.2
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = 'rgba(7, 7, 8, 0.45)'
    ctx.arc(bead.x, bead.y + 0.6, r + 1.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = palette.acid
    ctx.arc(bead.x, bead.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
    ctx.arc(bead.x - 1.6, bead.y - 2.1, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    syncBar()
    dock = layoutDock(width, height)
    drawDesktop(ctx, width, height, bar.barH)
    drawDock(ctx, dock, mode === 'pulling' ? null : cursor, !reduced)
    drawMenuBar(ctx, width, bar)
    const params = markParams()
    const color = mode === 'done' ? palette.heat : palette.acid
    const metrics = drawMark(ctx, smileX, smileMidY, smileSize, params, color)
    sim.anchor = { x: smileX, y: metrics.bottomY }
    if (sim.particles.length) {
      sim.particles[0] = { ...sim.anchor }
      sim.previous[0] = { ...sim.anchor }
    }

    drawRope()

    if (timeEl) {
      if (mode === 'pulling' && grabPoint) {
        timeEl.textContent = formatLive(duration)
        timeEl.dataset.snap = isSnap(duration) ? '1' : '0'
        timeEl.hidden = false
        const bead = sim.end
        const onRight = bead.x < width - 72
        timeEl.style.left = `${onRight ? bead.x + 14 : bead.x - 14}px`
        timeEl.style.top = `${bead.y}px`
        timeEl.style.transform = onRight ? 'translate(0, -50%)' : 'translate(-100%, -50%)'
      } else {
        timeEl.hidden = true
        timeEl.textContent = ''
      }
    }

    if (hint) {
      const showHint = mode === 'idle' && booted
      hint.hidden = !showHint
      if (showHint) {
        hint.style.left = `${smileX}px`
        hint.style.top = `${smileMidY + smileSize * 0.62}px`
      }
    }

    canvas.style.cursor = mode === 'pulling' ? 'grabbing' : hover ? 'grab' : 'default'
    root.classList.toggle('is-pulling', mode === 'pulling')
    root.classList.toggle('is-running', mode === 'running')
  }

  const frame = () => {
    const now = performance.now()
    const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 1 / 60
    lastTs = now
    tickAnim(now)

    if (!booted && now - bootAt >= (reduced ? 0 : BOOT_MS)) booted = true

    sim.anchor = smileAnchor()
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
      sim.pinsBothEnds = false
      sim.farAnchor = { ...grabPoint }
      const span = Math.hypot(grabPoint.x - sim.anchor.x, grabPoint.y - sim.anchor.y)
      sim.restLength = Math.max(40, span * sim.slack)
      if (reduced) {
        sim.layoutChord(sim.anchor, grabPoint)
      } else {
        sim.placeFreeEnd(grabPoint)
        sim.step(dt, bounds)
        sim.placeFreeEnd(grabPoint)
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
    if (reduced) booted = true
  }

  const ro = new ResizeObserver(() => layout())
  ro.observe(root)
  layout()

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('lostpointercapture', () => {
    if (mode === 'pulling') release()
  })
  window.addEventListener('keydown', onKey)
  motionMq.addEventListener('change', onMotion)
  onMotion()
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('keydown', onKey)
    motionMq.removeEventListener('change', onMotion)
  }
}
