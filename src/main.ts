import './style.css'
import { mountHero } from './hero'
import { mountFeatures } from './features'
import { mountTransit, onPage } from './transit'
import { site } from './site'

let stopPage: () => void = () => {}

const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const syncMotion = () => {
  document.documentElement.classList.toggle('reduced-motion', motionMq.matches)
}
syncMotion()
motionMq.addEventListener('change', syncMotion)

function bindCta(): void {
  const cta = document.querySelector('.cta')
  if (cta && site.dmgUrl) {
    cta.innerHTML = `
      <a class="btn" href="${site.dmgUrl}" download>Download</a>
      <p class="cta-meta">${site.platform} · ${site.bar}</p>
    `
  }
}

function mountPage(): void {
  stopPage()
  bindCta()
  const stage = document.getElementById('hero-stage')
  const stops = [stage ? mountHero(stage) : () => {}, mountFeatures()]
  stopPage = () => {
    for (const stop of stops) stop()
  }
}

onPage(mountPage)
mountTransit()
mountPage()

if (import.meta.hot) {
  import.meta.hot.dispose(() => stopPage())
}
