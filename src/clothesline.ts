import { RopeSim, type Pt, smoothRopePath } from './rope'

const CORAL = '#FF6B5A'
const CORAL_DEEP = '#c94b3e'
const PEG_T = [0.1, 0.3, 0.5, 0.7, 0.9]

function clamp(n: number, a = 0, b = 1): number {
  return Math.min(b, Math.max(a, n))
}

function sampleAt(pts: readonly Pt[], t: number): Pt {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
  let len = 0
  const segs: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    segs.push(d)
    len += d
  }
  let walk = clamp(t) * Math.max(len, 1)
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (walk <= seg || i === segs.length - 1) {
      const u = seg < 1e-6 ? 0 : walk / seg
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * u,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * u,
      }
    }
    walk -= seg
  }
  return pts[pts.length - 1]
}

export function mountClothesline(root: HTMLElement, slackEl: HTMLElement | null): () => void {
  const canvas = root.querySelector('[data-line]')
  const pegs = [...root.querySelectorAll<HTMLElement>('.peg')]
  if (!(canvas instanceof HTMLCanvasElement) || !pegs.length) return () => {}

  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const sim = new RopeSim()
  sim.particleCount = 36
  sim.iterations = 10
  sim.damping = 0.97
  sim.gravity = 1400
  sim.slack = 1.16
  sim.constraintRelax = 0.85
  sim.tailRelax = 1

  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motionMq.matches
  let raf = 0
  let lastTs = 0
  let width = 0
  let height = 0
  let dpr = 1
  let laid = false
  let hover: Pt | null = null
  let seen = false

  const pins = () => {
    const pad = Math.max(28, width * 0.06)
    const y = Math.max(56, height * 0.22)
    return {
      left: { x: pad, y },
      right: { x: width - pad, y },
    }
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
    const { left, right } = pins()
    const sag = Math.min(64, Math.max(28, w * 0.04))
    sim.layoutClothesline(left, right, sag)
    laid = true
  }

  const slackAmount = () => {
    if (!slackEl) return 0
    const r = slackEl.getBoundingClientRect()
    const vh = window.innerHeight
    return clamp((vh * 0.92 - r.top) / Math.max(vh * 0.55, 1))
  }

  const placePegs = () => {
    const pts = sim.particles
    pegs.forEach((el, i) => {
      const p = sampleAt(pts, PEG_T[i] ?? 0.5)
      el.style.left = `${p.x}px`
      el.style.top = `${p.y}px`
    })
  }

  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    if (sim.particles.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    smoothRopePath(ctx, sim.particles)
    ctx.strokeStyle = CORAL_DEEP
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 2.8
    ctx.stroke()
    smoothRopePath(ctx, sim.particles)
    ctx.strokeStyle = CORAL
    ctx.globalAlpha = 0.92
    ctx.lineWidth = 1.7
    ctx.stroke()
    ctx.restore()
    placePegs()
  }

  const frame = () => {
    const now = performance.now()
    const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 1 / 60
    lastTs = now
    if (!laid) layout()

    const { left, right } = pins()
    sim.anchor = left
    sim.farAnchor = right
    sim.pinsBothEnds = true
    const span = Math.hypot(right.x - left.x, right.y - left.y)
    const slack = slackAmount()
    sim.restLength = span * (1.14 + slack * 0.28)

    if (reduced) {
      sim.layoutClothesline(left, right, 28 + slack * 36)
    } else {
      if (hover) sim.tugInterior(hover, 0.1)
      sim.step(dt, { width, height })
    }

    draw()
    raf = requestAnimationFrame(frame)
  }

  const onMove = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    hover = { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onLeave = () => {
    hover = null
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (reduced) return
      for (const entry of entries) {
        if (entry.isIntersecting && !seen) {
          seen = true
          root.classList.add('is-in')
        }
      }
    },
    { threshold: 0.28 },
  )
  io.observe(root)

  const ro = new ResizeObserver(() => {
    laid = false
  })
  ro.observe(root)
  layout()
  const onMotion = () => {
    reduced = motionMq.matches
  }
  motionMq.addEventListener('change', onMotion)
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerleave', onLeave)
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    io.disconnect()
    motionMq.removeEventListener('change', onMotion)
    root.removeEventListener('pointermove', onMove)
    root.removeEventListener('pointerleave', onLeave)
  }
}
