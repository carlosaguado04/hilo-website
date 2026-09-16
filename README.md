# Hilo

Marketing site for [Hilo](https://hilo.acidity.lol) — a Mac menu-bar timer with a hanging thread.

Pull the string. Steal the time.

Canonical: **hilo.acidity.lol**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5174

```bash
bun install
bun run dev
```

works the same if you use bun.

## Scripts

- `npm run dev` / `bun run dev`
- `npm run build` / `bun run build`
- `npm run preview` / `bun run preview`

## Pages

- `/` — hero (pullable timer). Do not restyle the canvas.
- `/features` — product story. Soft hop + GSAP reveals.

## Stack

- Vite + TypeScript (MPA)
- GSAP + ScrollTrigger
- Canvas rope (Verlet hang) + smile → circle mark
- Satoshi Regular + Bold. The **Hilo** mark is Satoshi Bold — not Anurati.
- No Three.js

## Demo

The hero is a marketing timer, not a second Hilo.

- Drag the smile. The thread appears only while you pull (demo ceiling 15 seconds).
- Duration sits at the grab. Smile becomes a circle and unfills while it runs.
- Escape returns to idle. The demo also resets when the pull runs out.
- `prefers-reduced-motion` uses a static chord while pulling. The demo still sets and unfills.

Download is **Coming soon** until a DMG URL is set in `src/site.ts` (`dmgUrl`). Never Mac App Store / TestFlight.

## Brand

void `#070708`, ink `#f2f2ef` / mute `#9a9a96`, acid `#e8ff3d`. Heat / ember sparingly.

A product of [Acidity](https://acidity.lol).
