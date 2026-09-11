/** Menu-bar smile ↔ circle. Thick round stroke, same sweep math as the app. */

export const SMILE_SWEEP = 2.12

export type MarkParams = {
  sag: number
  morph: number
  progress: number
}

export type MarkMetrics = {
  lineWidth: number
  cx: number
  cy: number
  radius: number
  sweep: number
  bottomY: number
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function markMetrics(cx: number, midY: number, size: number, params: MarkParams): MarkMetrics {
  const sagT = clamp01(params.sag)
  const morphT = clamp01(params.morph)
  const progressT = clamp01(params.progress)
  const lineWidth = size * 0.21
  const pad = lineWidth * 0.5 + size * 0.08
  const baseR = Math.max(2, size / 2 - pad)
  const smileCY = midY + size * 0.05 + sagT * size * 0.12
  const smileR = baseR + sagT * size * 0.09
  const cy = smileCY + (midY - smileCY) * morphT
  const radius = smileR + (baseR - smileR) * morphT
  const smile = SMILE_SWEEP + sagT * 0.62
  const ring = Math.PI * 2 * progressT
  const sweep = smile + morphT * (ring - smile)
  return {
    lineWidth,
    cx,
    cy,
    radius,
    sweep,
    bottomY: cy + radius,
  }
}

export function drawMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  midY: number,
  size: number,
  params: MarkParams,
  color: string,
): MarkMetrics {
  const m = markMetrics(cx, midY, size, params)
  if (m.sweep < 0.06) return m

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = m.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (params.morph > 0.45 && params.progress < 0.995) {
    ctx.save()
    ctx.globalAlpha = 0.16 * params.morph
    ctx.beginPath()
    ctx.arc(m.cx, m.cy, m.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  if (m.sweep >= Math.PI * 2 - 0.02) {
    ctx.arc(m.cx, m.cy, m.radius, 0, Math.PI * 2)
  } else {
    // Canvas y-down: π/2 is 6 o’clock, so a short clockwise sweep is a smile.
    const mid = Math.PI * 0.5
    ctx.arc(m.cx, m.cy, m.radius, mid - m.sweep / 2, mid + m.sweep / 2, false)
  }
  ctx.stroke()
  ctx.restore()
  return m
}
