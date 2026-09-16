/** Product facts for the marketing page. No invented store, Pro, or inbox. */

export const site = {
  name: 'Hilo',
  tagline: 'Pull the string. Steal the time.',
  lede: 'A menu-bar timer with a hanging thread.',
  description:
    'Hilo — Pull the string. Steal the time. A Mac menu-bar timer with a hanging thread. Drag to set it, watch the smile become a circle, then unfill as it runs out.',
  url: 'https://hilo.acidity.lol',
  acidityUrl: 'https://acidity.lol',
  platform: 'Apple Silicon',
  bar: 'Mac menu-bar',
  year: 2026,
  /** No DMG in this repo — never invent App Store / TestFlight. */
  dmgUrl: null as string | null,
} as const

export const palette = {
  void: '#070708',
  voidLift: '#0e0e11',
  voidRaised: '#15151a',
  ink: '#f2f2ef',
  mute: '#9a9a96',
  dim: '#5c5c58',
  acid: '#e8ff3d',
  acidDeep: '#b8cc22',
  heat: '#ff3b6b',
  ember: '#ff7a3d',
} as const
