/** Single-strand Verlet hang — same idea as the Mac overlay. */

export type Pt = { x: number; y: number }

export function copyPts(pts: readonly Pt[]): Pt[] {
  return pts.map((p) => ({ x: p.x, y: p.y }))
}

export function chord(from: Pt, to: Pt, count: number): Pt[] {
  const n = Math.max(2, count)
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return { x: from.x + dx * t, y: from.y + dy * t }
  })
}

/** Catenary-ish bow. Real sag, not a taut chord. */
export function saggingCurve(from: Pt, to: Pt, count: number): Pt[] {
  const n = Math.max(2, count)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const span = Math.max(Math.hypot(dx, dy), 1)
  const bow = Math.max(22, span * 0.22)
  let nx = -dy / span
  let ny = dx / span
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  if (Math.abs(nx) < 0.2) {
    nx = 1
    ny = 0
  }
  return Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(n - 1, 1)
    const parabola = 4 * t * (1 - t)
    return {
      x: from.x + dx * t + nx * bow * parabola,
      y: from.y + dy * t + bow * parabola * 0.35,
    }
  })
}

export function clothesline(from: Pt, to: Pt, sag: number, count: number): Pt[] {
  const n = Math.max(2, count)
  const drop = Math.max(8, sag)
  const control = {
    x: (from.x + to.x) * 0.5,
    y: (from.y + to.y) * 0.5 + drop * 2,
  }
  return Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(n - 1, 1)
    const u = 1 - t
    return {
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    }
  })
}

export function polylineDistance(point: Pt, pts: readonly Pt[]): number {
  if (pts.length < 2) return Infinity
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = point.x - a.x
    const apy = point.y - a.y
    const ab2 = abx * abx + aby * aby
    let d: number
    if (ab2 < 1e-8) {
      d = Math.hypot(apx, apy)
    } else {
      const t = Math.min(Math.max((apx * abx + apy * aby) / ab2, 0), 1)
      d = Math.hypot(point.x - (a.x + t * abx), point.y - (a.y + t * aby))
    }
    if (d < best) best = d
  }
  return best
}

export function smoothRopePath(ctx: CanvasRenderingContext2D, points: readonly Pt[]): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y)
    return
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6,
      p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6,
      p2.y - (p3.y - p1.y) / 6,
      p2.x,
      p2.y,
    )
  }
}

export class RopeSim {
  particles: Pt[] = []
  previous: Pt[] = []
  restLength = 120
  anchor: Pt = { x: 0, y: 0 }
  farAnchor: Pt = { x: 0, y: 0 }
  pinsBothEnds = false
  particleCount = 22
  gravity = 1960
  damping = 0.96
  iterations = 10
  hitThreshold = 20
  slack = 1.32
  constraintRelax = 0.62
  tailRelax = 0.38

  get lastIndex(): number {
    return Math.max(0, this.particles.length - 1)
  }

  get end(): Pt {
    return this.particles[this.lastIndex] ?? this.farAnchor
  }

  reset(anchor: Pt, end: Pt): void {
    this.anchor = { ...anchor }
    this.farAnchor = { ...end }
    const span = Math.hypot(end.x - anchor.x, end.y - anchor.y)
    this.restLength = Math.max(36, span * this.slack)
    this.particles = saggingCurve(anchor, end, this.particleCount)
    this.previous = copyPts(this.particles)
  }

  layoutSagging(from: Pt, to: Pt): void {
    this.anchor = { ...from }
    this.farAnchor = { ...to }
    this.particles = saggingCurve(from, to, Math.max(2, this.particleCount))
    this.previous = copyPts(this.particles)
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    this.restLength = Math.max(this.restLength, Math.max(36, span * this.slack))
  }

  layoutChord(from: Pt, to: Pt): void {
    this.anchor = { ...from }
    this.farAnchor = { ...to }
    this.particles = chord(from, to, this.particleCount)
    this.previous = copyPts(this.particles)
  }

  placeFreeEnd(point: Pt): void {
    if (this.particles.length < 2) return
    const last = this.lastIndex
    this.particles[last] = { ...point }
    this.previous[last] = { ...point }
    this.particles[0] = { ...this.anchor }
    this.previous[0] = { ...this.anchor }
  }

  /** Shear the chain so the free end moves to `point`. No particle is locked stiff. */
  followEnd(point: Pt): void {
    if (this.particles.length < 2) return
    const last = this.lastIndex
    const dx = point.x - this.particles[last].x
    const dy = point.y - this.particles[last].y
    if (dx === 0 && dy === 0) return
    for (let i = 1; i <= last; i++) {
      const t = i / last
      this.particles[i].x += dx * t
      this.particles[i].y += dy * t
      this.previous[i].x += dx * t
      this.previous[i].y += dy * t
    }
    this.particles[0] = { ...this.anchor }
    this.previous[0] = { ...this.anchor }
  }

  pinEnds(): void {
    if (!this.particles.length) return
    this.particles[0] = { ...this.anchor }
    this.previous[0] = { ...this.anchor }
    if (this.pinsBothEnds && this.particles.length > 1) {
      const last = this.lastIndex
      this.particles[last] = { ...this.farAnchor }
      this.previous[last] = { ...this.farAnchor }
    }
  }

  isPinned(index: number): boolean {
    if (index === 0) return true
    return this.pinsBothEnds && index === this.lastIndex
  }

  step(dt: number, bounds: { width: number; height: number }): void {
    if (this.particles.length < 2) return
    const clamped = Math.min(Math.max(dt, 1 / 240), 1 / 20)
    const gravity = this.gravity * clamped * clamped
    const last = this.lastIndex
    const lo = 1
    const hi = this.pinsBothEnds ? last : this.particles.length
    for (let i = lo; i < hi; i++) {
      if (this.isPinned(i)) continue
      const position = this.particles[i]
      const prev = this.previous[i]
      const next = {
        x: position.x + (position.x - prev.x) * this.damping,
        y: position.y + (position.y - prev.y) * this.damping + gravity,
      }
      next.x = Math.min(Math.max(next.x, 4), Math.max(4, bounds.width - 4))
      next.y = Math.min(Math.max(next.y, 4), Math.max(4, bounds.height - 4))
      this.previous[i] = { ...position }
      this.particles[i] = next
    }
    this.pinEnds()
    this.satisfyConstraints()
    this.pinEnds()
  }

  /** Keep interior particles from hanging past a drag bead at `maxY`. */
  clampInteriorY(maxY: number): void {
    const last = this.lastIndex
    for (let i = 1; i < last; i++) {
      if (this.particles[i].y > maxY) this.particles[i].y = maxY
    }
  }

  satisfyConstraints(): void {
    const count = this.particles.length
    if (count < 2) return
    const last = count - 1
    const segment = this.restLength / (count - 1)
    const hardLast = this.pinsBothEnds ? last : Math.max(0, last - 1)
    for (let k = 0; k < this.iterations; k++) {
      this.pinEnds()
      for (let i = 0; i < hardLast; i++) this.applySegment(i, segment, this.constraintRelax)
      this.pinEnds()
    }
    if (!this.pinsBothEnds && last >= 1) this.applySegment(last - 1, segment, this.tailRelax)
  }

  hits(point: Pt, extra = 0): boolean {
    return polylineDistance(point, this.particles) <= this.hitThreshold + extra
  }

  hitsBead(point: Pt, radius = 22): boolean {
    const end = this.end
    return Math.hypot(point.x - end.x, point.y - end.y) <= radius
  }

  blendToward(target: readonly Pt[], amount: number): void {
    if (this.particles.length !== target.length || this.particles.length < 2) return
    const a = Math.min(1, Math.max(0, amount))
    for (let i = 0; i < this.particles.length; i++) {
      if (this.isPinned(i)) continue
      this.particles[i].x += (target[i].x - this.particles[i].x) * a
      this.particles[i].y += (target[i].y - this.particles[i].y) * a
    }
    this.pinEnds()
  }

  layoutClothesline(from: Pt, to: Pt, sag: number): void {
    this.pinsBothEnds = true
    this.anchor = { ...from }
    this.farAnchor = { ...to }
    const span = Math.max(Math.hypot(to.x - from.x, to.y - from.y), 1)
    this.restLength = Math.max(span * this.slack, span + sag * 1.25)
    this.particles = clothesline(from, to, sag, Math.max(2, this.particleCount))
    this.previous = copyPts(this.particles)
  }

  tugInterior(point: Pt, stiffness = 0.28): void {
    if (this.particles.length < 3) return
    let best = 1
    let bestD = Infinity
    for (let i = 1; i < this.lastIndex; i++) {
      const d = Math.hypot(point.x - this.particles[i].x, point.y - this.particles[i].y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    const p = this.particles[best]
    p.x += (point.x - p.x) * stiffness
    p.y += (point.y - p.y) * stiffness
  }

  poseSagging(from: Pt, to: Pt): void {
    this.layoutSagging(from, to)
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    this.restLength = Math.max(36, span * this.slack)
  }

  private applySegment(index: number, rest: number, relax: number): void {
    const a = this.particles[index]
    const b = this.particles[index + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1e-6) return
    const diff = ((distance - rest) / distance) * relax
    const pinA = this.isPinned(index)
    const pinB = this.isPinned(index + 1)
    if (pinA && pinB) return
    if (pinA) {
      b.x -= dx * diff
      b.y -= dy * diff
    } else if (pinB) {
      a.x += dx * diff
      a.y += dy * diff
    } else {
      const half = diff * 0.5
      a.x += dx * half
      a.y += dy * half
      b.x -= dx * half
      b.y -= dy * half
    }
  }
}
