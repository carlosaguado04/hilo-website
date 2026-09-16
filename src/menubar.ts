import { palette } from './site'

export type BarLayout = {
  barH: number
  smileX: number
  smileY: number
  smileSize: number
  mobile: boolean
  clock: string
  clockRight: number
  wifiX: number
  batteryX: number | null
  searchX: number
}

const INK = palette.ink
const MUTE = palette.mute
/** Optical size shared by apple, search, wifi, battery, smile. */
const ICON = 15
/** Horizontal pitch between status-item centers. */
const SLOT = 32

export function menuClock(date: Date, compact: boolean): string {
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (compact) return time
  const day = date.toLocaleDateString(undefined, { weekday: 'short' })
  return `${day} ${time}`
}

export function layoutBar(width: number, now = new Date()): BarLayout {
  const mobile = width < 640
  const barH = mobile ? 30 : 32
  const pad = mobile ? 14 : 20
  const clock = menuClock(now, mobile)
  const clockWidth = estimateClock(clock)

  let x = width - pad
  const clockRight = x
  x -= clockWidth + 22
  const wifiX = x
  x -= SLOT
  let batteryX: number | null = null
  if (!mobile) {
    batteryX = x
    x -= SLOT
  }
  const smileX = x
  x -= SLOT
  const searchX = x

  return {
    barH,
    smileX,
    smileY: barH * 0.5,
    smileSize: 18,
    mobile,
    clock,
    clockRight,
    wifiX,
    batteryX,
    searchX,
  }
}

function estimateClock(text: string): number {
  return Math.max(40, text.length * 7.1)
}

export function drawMenuBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  layout: BarLayout,
): void {
  const { barH, mobile, clock, clockRight, wifiX, batteryX, searchX } = layout
  ctx.save()
  ctx.fillStyle = '#141416'
  ctx.fillRect(0, 0, width, barH)
  ctx.fillStyle = 'rgba(242, 242, 239, 0.1)'
  ctx.fillRect(0, barH - 1, width, 1)

  const cy = barH * 0.5
  const pad = mobile ? 14 : 20

  drawApple(ctx, pad + ICON * 0.45, cy, ICON)
  let mx = pad + ICON + 14
  const menus = mobile ? ['Finder'] : ['Finder', 'File', 'Edit', 'View']
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  menus.forEach((label, i) => {
    ctx.font = `${i === 0 ? 700 : 400} 13px Satoshi, system-ui, sans-serif`
    const w = ctx.measureText(label).width
    if (mx + w > searchX - 20) return
    ctx.fillStyle = i === 0 ? INK : MUTE
    ctx.fillText(label, mx, cy + 0.5)
    mx += w + 22
  })

  ctx.font = '400 13px Satoshi, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = INK
  ctx.fillText(clock, clockRight, cy + 0.5)

  drawWifi(ctx, wifiX, cy, ICON)
  if (batteryX !== null) drawBattery(ctx, batteryX, cy, ICON)
  drawSearch(ctx, searchX, cy, ICON)

  ctx.restore()
}

function inkStroke(ctx: CanvasRenderingContext2D, width = 1.55): void {
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function drawApple(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size * 0.52
  ctx.save()
  ctx.translate(cx, cy + 1)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.moveTo(0, s * 0.42)
  ctx.bezierCurveTo(-s * 0.52, s * 0.42, -s * 0.56, -s * 0.06, -s * 0.18, -s * 0.26)
  ctx.bezierCurveTo(-s * 0.04, -s * 0.34, s * 0.06, -s * 0.34, s * 0.16, -s * 0.26)
  ctx.bezierCurveTo(s * 0.5, -s * 0.04, s * 0.46, s * 0.42, 0, s * 0.42)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(s * 0.1, -s * 0.42, s * 0.13, s * 0.22, 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawWifi(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save()
  inkStroke(ctx)
  const originY = cy + size * 0.28
  for (const t of [0.22, 0.36, 0.5]) {
    const r = size * t
    const a = 0.66
    ctx.beginPath()
    ctx.arc(cx, originY, r, Math.PI + a, -a, false)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBattery(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save()
  inkStroke(ctx)
  const w = size * 1.05
  const h = size * 0.52
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 1.6)
  ctx.stroke()
  ctx.fillRect(cx + w / 2 + 1.15, cy - 1.5, 1.6, 3)
  roundRect(ctx, cx - w / 2 + 1.6, cy - h / 2 + 1.6, w * 0.55, h - 3.2, 0.6)
  ctx.fill()
  ctx.restore()
}

function drawSearch(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save()
  inkStroke(ctx)
  const r = size * 0.28
  const ox = cx - size * 0.08
  const oy = cy - size * 0.08
  ctx.beginPath()
  ctx.arc(ox, oy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  const a = Math.PI * 0.25
  ctx.moveTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r)
  ctx.lineTo(ox + Math.cos(a) * size * 0.48, oy + Math.sin(a) * size * 0.48)
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
