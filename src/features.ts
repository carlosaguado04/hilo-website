import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function mountFeatures(): () => void {
  const root = document.querySelector('.features')
  if (!root) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const beats = [...root.querySelectorAll<HTMLElement>('.beat')]
  const ticks = [...root.querySelectorAll<HTMLElement>('.idea-strip li')]

  const setTick = (index: number) => {
    ticks.forEach((el, i) => el.classList.toggle('is-on', i === index))
  }

  if (reduced) {
    for (const el of beats) el.classList.add('is-in')
    setTick(0)
    return () => {}
  }

  const ctx = gsap.context(() => {
    gsap.fromTo(
      '.page-title',
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.62, ease: 'power3.out' },
    )
    gsap.fromTo(
      '.idea-strip',
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.55, delay: 0.08, ease: 'power3.out' },
    )

    beats.forEach((el, i) => {
      gsap.fromTo(
        el,
        { y: 22, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            once: true,
            immediateRender: false,
          },
        },
      )
      const edge = el.querySelector('.beat-edge')
      if (edge) {
        gsap.fromTo(
          edge,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        )
      }
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive) setTick(i)
        },
      })
    })
  }, root)

  setTick(0)

  return () => {
    ctx.revert()
  }
}
