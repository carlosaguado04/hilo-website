import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function mountFeatures(): () => void {
  const root = document.querySelector('.features')
  if (!root) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const drops = [...root.querySelectorAll<HTMLElement>('.drop')]

  if (reduced) {
    for (const el of drops) el.classList.add('is-in')
    return () => {}
  }

  const ctx = gsap.context(() => {
    gsap.fromTo(
      '.page-title',
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
    )

    drops.forEach((el, i) => {
      gsap.fromTo(
        el,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.78,
          ease: 'power3.out',
          delay: i * 0.03,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
            immediateRender: false,
          },
        },
      )
      const rule = el.querySelector('.drop-rule')
      if (rule) {
        gsap.fromTo(
          rule,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        )
      }
    })

    gsap.fromTo(
      '.works-kicker, .soon-row',
      { y: 16, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.works-kicker', start: 'top 90%', once: true },
      },
    )
  }, root)

  return () => {
    ctx.revert()
  }
}
