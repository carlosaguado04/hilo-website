import { palette } from './site'

export type DockLayout = {
  x: number
  y: number
  w: number
  h: number
  icon: number
}

const INK = palette.ink

export function layoutDock(width: number, height: number): DockLayout {
  const mobile = width < 640
  const icon = mobile ? 30 : 38
  const gap = mobile ? 8 : 10
  const pad = mobile ? 8 : 10
  const count = mobile ? 5 : 6
  const divider = 10
  const inner = count * icon + (count - 1) * gap + divider + icon
  const w = inner + pad * 2
  const h = icon + pad * 2
  return {
    x: (width - w) / 2,
    y: height - h - (mobile ? 10 : 14),
    w,
    h,
    icon,
  }
}

export function drawDesktop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  barH: number,
): void {
  ctx.save()
  ctx.fillStyle = '#0b0b0d'
  ctx.fillRect(0, barH, width, height - barH)
  ctx.restore()
}

type DockPointer = { x: number; y: number }

let magScales: number[] = []

function dockRoster(icon: number): { name: Glyph | 'trash'; afterGap: number }[] {
  const gap = icon < 34 ? 8 : 10
  const apps: Glyph[] =
    icon < 34
      ? ['finder', 'browser', 'notes', 'mail', 'term']
      : ['finder', 'browser', 'notes', 'mail', 'term', 'music']
  return [
    ...apps.map((name, i) => ({
      name,
      afterGap: i === apps.length - 1 ? gap + 10 : gap,
    })),
    { name: 'trash' as const, afterGap: 0 },
  ]
}

export function drawDock(
  ctx: CanvasRenderingContext2D,
  dock: DockLayout,
  pointer: DockPointer | null = null,
  animate = true,
): void {
  const { x, y, w, h, icon } = dock
  const r = Math.min(18, h * 0.42)
  ctx.save()
  ctx.fillStyle = 'rgba(20, 20, 24, 0.94)'
  ctx.strokeStyle = 'rgba(242, 242, 239, 0.12)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(242, 242, 239, 0.06)'
  ctx.moveTo(x + 12, y + 1)
  ctx.lineTo(x + w - 12, y + 1)
  ctx.stroke()

  const pad = (h - icon) / 2
  const items = dockRoster(icon)
  if (magScales.length !== items.length) magScales = items.map(() => 1)

  const rest: number[] = []
  let rx = x + pad + icon / 2
  for (const item of items) {
    rest.push(rx)
    rx += icon + item.afterGap
  }

  const hot =
    pointer &&
    pointer.y > y - icon * 1.8 &&
    pointer.y < y + h + 16 &&
    pointer.x > x - 24 &&
    pointer.x < x + w + 24
  const range = icon * 3.15
  const boost = 0.82
  for (let i = 0; i < items.length; i++) {
    let target = 1
    if (hot && pointer) {
      const t = Math.max(0, 1 - Math.abs(pointer.x - rest[i]) / range)
      const smooth = t * t * (3 - 2 * t)
      target = 1 + boost * smooth
    }
    magScales[i] += (target - magScales[i]) * (animate ? 0.24 : 1)
  }

  const sizes = magScales.map((s) => icon * s)
  const total =
    sizes.reduce((sum, s, i) => sum + s + items[i].afterGap, 0) - items[items.length - 1].afterGap
  let cursor = x + (w - total) / 2
  const floor = y + h - pad

  items.forEach((item, i) => {
    const s = sizes[i]
    const cx = cursor + s / 2
    const cy = floor - s / 2
    if (item.name === 'trash') {
      const prev = items[i - 1]
      if (prev) {
        const divX = cursor - prev.afterGap / 2
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(242, 242, 239, 0.14)'
        ctx.lineWidth = 1
        ctx.moveTo(divX, y + pad + 4)
        ctx.lineTo(divX, y + h - pad - 4)
        ctx.stroke()
      }
      drawTile(ctx, cx, cy, s)
      drawTrash(ctx, cx, cy, s)
    } else {
      drawTile(ctx, cx, cy, s)
      drawGlyph(ctx, item.name, cx, cy, s)
    }
    cursor += s + item.afterGap
  })
  ctx.restore()
}

function drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size
  const r = s * 0.24
  ctx.save()
  ctx.fillStyle = '#1c1c22'
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, r)
  ctx.fill()
  ctx.restore()
}

function glyphStroke(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = Math.max(1.3, size * 0.045)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

type Glyph = 'finder' | 'browser' | 'notes' | 'mail' | 'term' | 'music'

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  name: Glyph,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save()
  glyphStroke(ctx, size)
  const s = size * 0.42
  switch (name) {
    case 'finder':
      roundRect(ctx, cx - s, cy - s * 0.85, s * 1.7, s * 1.7, s * 0.22)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s + s * 0.55, cy - s * 0.85)
      ctx.lineTo(cx - s + s * 0.55, cy + s * 0.85)
      ctx.stroke()
      break
    case 'browser':
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.78, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy + s * 0.12)
      ctx.lineTo(cx - s * 0.22, cy - s * 0.18)
      ctx.lineTo(cx + s * 0.38, cy - s * 0.08)
      ctx.closePath()
      ctx.stroke()
      break
    case 'notes':
      roundRect(ctx, cx - s * 0.7, cy - s * 0.85, s * 1.4, s * 1.7, 2)
      ctx.stroke()
      for (const t of [-0.25, 0.05, 0.35]) {
        ctx.beginPath()
        ctx.moveTo(cx - s * 0.42, cy + s * t)
        ctx.lineTo(cx + s * 0.42, cy + s * t)
        ctx.stroke()
      }
      break
    case 'mail':
      roundRect(ctx, cx - s * 0.85, cy - s * 0.55, s * 1.7, s * 1.15, 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.85, cy - s * 0.55)
      ctx.lineTo(cx, cy + s * 0.12)
      ctx.lineTo(cx + s * 0.85, cy - s * 0.55)
      ctx.stroke()
      break
    case 'term':
      roundRect(ctx, cx - s * 0.85, cy - s * 0.7, s * 1.7, s * 1.4, 2.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.45, cy - s * 0.15)
      ctx.lineTo(cx - s * 0.12, cy)
      ctx.lineTo(cx - s * 0.45, cy + s * 0.15)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.02, cy + s * 0.28)
      ctx.lineTo(cx + s * 0.42, cy + s * 0.28)
      ctx.stroke()
      break
    case 'music':
      ctx.beginPath()
      ctx.arc(cx - s * 0.28, cy + s * 0.35, s * 0.28, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy + s * 0.35)
      ctx.lineTo(cx, cy - s * 0.55)
      ctx.lineTo(cx + s * 0.55, cy - s * 0.35)
      ctx.stroke()
      break
  }
  ctx.restore()
}

function drawTrash(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save()
  glyphStroke(ctx, size)
  const s = size * 0.38
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.7, cy - s * 0.35)
  ctx.lineTo(cx + s * 0.7, cy - s * 0.35)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.28, cy - s * 0.35)
  ctx.lineTo(cx - s * 0.28, cy - s * 0.58)
  ctx.lineTo(cx + s * 0.28, cy - s * 0.58)
  ctx.lineTo(cx + s * 0.28, cy - s * 0.35)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.55, cy - s * 0.35)
  ctx.lineTo(cx - s * 0.4, cy + s * 0.7)
  ctx.lineTo(cx + s * 0.4, cy + s * 0.7)
  ctx.lineTo(cx + s * 0.55, cy - s * 0.35)
  ctx.stroke()
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
