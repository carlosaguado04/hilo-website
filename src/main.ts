import './style.css'
import { mountClothesline } from './clothesline'
import { mountHero } from './hero'

const year = document.getElementById('year')
if (year) year.textContent = String(new Date().getFullYear())

const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const syncMotion = () => {
  document.documentElement.classList.toggle('reduced-motion', motionMq.matches)
}
syncMotion()
motionMq.addEventListener('change', syncMotion)

const stage = document.getElementById('hero-stage')
const line = document.getElementById('kit')
const land = document.getElementById('get')
const stops = [
  stage ? mountHero(stage) : () => {},
  line ? mountClothesline(line, land) : () => {},
]

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const stop of stops) stop()
  })
}
