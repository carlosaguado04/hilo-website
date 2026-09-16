import './style.css'
import { mountHero } from './hero'
import { site } from './site'

const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const syncMotion = () => {
  document.documentElement.classList.toggle('reduced-motion', motionMq.matches)
}
syncMotion()
motionMq.addEventListener('change', syncMotion)

const cta = document.querySelector('.cta')
if (cta && site.dmgUrl) {
  cta.innerHTML = `
    <a class="btn" href="${site.dmgUrl}" download>Download</a>
    <p class="cta-meta">${site.platform} · ${site.bar}</p>
  `
}

const stage = document.getElementById('hero-stage')
const stops = [stage ? mountHero(stage) : () => {}]

const revealEls = [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
const io =
  revealEls.length === 0
    ? null
    : new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in')
              io?.unobserve(entry.target)
            }
          }
        },
        { threshold: 0.22, rootMargin: '0px 0px -8% 0px' },
      )
if (motionMq.matches) {
  for (const el of revealEls) el.classList.add('is-in')
} else {
  for (const el of revealEls) io?.observe(el)
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const stop of stops) stop()
    io?.disconnect()
  })
}
