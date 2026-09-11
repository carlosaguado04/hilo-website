/** Pull → seconds, clamped for the on-page demo. */

export const MIN_SECONDS = 3
export const MAX_SECONDS = 10
export const SNAPS = [5, 10] as const
export const SLACK = 28

export function clampPull(seconds: number): number {
  return Math.min(Math.max(seconds, MIN_SECONDS), MAX_SECONDS)
}

export function magnetWindow(target: number): number {
  return Math.max(1, target * 0.12)
}

export function quantize(seconds: number): number {
  const s = clampPull(seconds)
  let step: number
  if (s < 60) step = 1
  else if (s < 3 * 60) step = 5
  else if (s < 20 * 60) step = 15
  else step = 30
  return Math.max(MIN_SECONDS, Math.round(s / step) * step)
}

export function present(seconds: number): number {
  const raw = clampPull(seconds)
  for (const target of SNAPS) {
    if (Math.abs(raw - target) <= magnetWindow(target)) return target
  }
  return quantize(raw)
}

export function secondsFromPull(distance: number, extraForMax: number): number {
  const extra = Math.max(0, distance - SLACK)
  const span = Math.max(80, extraForMax)
  const growth = Math.log(MAX_SECONDS / MIN_SECONDS) / span
  const raw = MIN_SECONDS * Math.exp(extra * growth)
  return present(raw)
}

export function formatClock(interval: number): string {
  const total = Math.max(0, Math.round(interval))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatLive(interval: number): string {
  const total = Math.max(0, Math.round(interval))
  if (total < 60) return `${total}s`
  return formatClock(interval)
}

export function isSnap(seconds: number): boolean {
  return SNAPS.some((target) => target === seconds)
}
