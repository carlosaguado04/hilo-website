/** Pull → seconds. Marketing demo: short floor, 15s ceiling. */

export const MIN_SECONDS = 3
export const MAX_SECONDS = 15
export const SNAPS = [5, 10, 15] as const
export const SLACK = 28

export function clampPull(seconds: number): number {
  return Math.min(Math.max(seconds, MIN_SECONDS), MAX_SECONDS)
}

export function magnetWindow(target: number): number {
  return Math.max(1, target * 0.12)
}

export function quantize(seconds: number): number {
  return Math.max(MIN_SECONDS, Math.round(clampPull(seconds)))
}

export function present(seconds: number): number {
  const raw = clampPull(seconds)
  for (const target of SNAPS) {
    if (Math.abs(raw - target) <= magnetWindow(target)) return target
  }
  return quantize(raw)
}

/** Log map. `extraForMax` is the pixel run that lands on the 15s ceiling. */
export function secondsFromPull(distance: number, extraForMax: number): number {
  const extra = Math.max(0, distance - SLACK)
  const span = Math.max(48, extraForMax)
  const growth = Math.log(MAX_SECONDS / MIN_SECONDS) / span
  const raw = MIN_SECONDS * Math.exp(extra * growth)
  return present(raw)
}

export function extraForMax(availableExtra: number): number {
  return Math.max(80, availableExtra)
}

export function formatLive(interval: number): string {
  const total = Math.max(0, Math.round(interval))
  return `${total}s`
}

export function isSnap(seconds: number): boolean {
  return SNAPS.some((target) => target === seconds)
}
