/** Soft hops. View Transitions + void cut. Does not touch the hero canvas. */

type HopOpts = { push?: boolean }

const reduceMq = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function pathOf(url: string): string {
  let p = new URL(url, location.href).pathname
  if (p.endsWith('/index.html')) p = p.slice(0, -10) || '/'
  p = p.replace(/\/+$/, '') || '/'
  return p
}

function sameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin
  } catch {
    return false
  }
}

function isSoftTarget(a: HTMLAnchorElement | null): boolean {
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return false
  const href = a.getAttribute('href') || ''
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }
  return sameOrigin(href)
}

function syncNav(pathname: string): void {
  const norm = pathOf(pathname)
  document.querySelectorAll('.primary-nav a[href]').forEach((el) => {
    const a = el as HTMLAnchorElement
    if (pathOf(a.href) === norm) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  })
}

function swapChrome(doc: Document, selector: string, beforeMain: boolean): void {
  const cur = document.querySelector(selector)
  const next = doc.querySelector(selector)
  if (next) {
    const node = document.importNode(next, true)
    if (cur) cur.replaceWith(node)
    else if (beforeMain) document.querySelector('#main')?.before(node)
    else document.querySelector('#main')?.after(node)
  } else if (cur) {
    cur.remove()
  }
}

function swapDom(doc: Document): void {
  const nextMain = doc.querySelector('#main')
  if (!nextMain) throw new Error('no #main')
  document.title = doc.title || document.title
  document.body.className = doc.body.className || ''
  document.querySelector('#main')?.replaceWith(document.importNode(nextMain, true))
  swapChrome(doc, '.site-header', true)
  swapChrome(doc, '.end', false)
  const nextTheme = doc.querySelector('meta[name="theme-color"]')
  const curTheme = document.querySelector('meta[name="theme-color"]')
  if (nextTheme && curTheme) {
    curTheme.setAttribute('content', nextTheme.getAttribute('content') || '#070708')
  }
  syncNav(location.pathname)
  window.scrollTo(0, 0)
  document.documentElement.classList.add('is-entering')
}

const waitMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const waitPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let busy = false
let onAfter: (() => void) | null = null

export function onPage(fn: () => void): void {
  onAfter = fn
}

async function hop(url: string, { push = true }: HopOpts = {}): Promise<void> {
  const abs = new URL(url, location.href)
  if (pathOf(abs.href) === pathOf(location.href) && abs.hash === location.hash) return
  if (busy) return
  busy = true
  try {
    const candidates = [abs.href]
    if (!abs.pathname.endsWith('/') && !abs.pathname.endsWith('.html')) {
      const slash = new URL(abs.href)
      slash.pathname = `${slash.pathname}/`
      candidates.push(slash.href)
    }
    let res: Response | null = null
    for (const href of candidates) {
      const attempt = await fetch(href, {
        headers: { Accept: 'text/html' },
        credentials: 'same-origin',
      })
      if (attempt.ok) {
        res = attempt
        break
      }
    }
    if (!res) {
      location.href = abs.href
      return
    }
    const html = await res.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (!doc.querySelector('#main')) {
      location.href = abs.href
      return
    }
    const swapOnly = () => {
      if (push) history.pushState({ soft: true }, '', abs.href)
      swapDom(doc)
    }
    const startVt = document.startViewTransition
    if (!reduceMq() && typeof startVt === 'function') {
      const vt = startVt.call(document, swapOnly)
      await Promise.race([vt.finished.catch(() => undefined), waitMs(900)])
      await waitPaint()
    } else {
      swapOnly()
      await waitPaint()
    }
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('is-entering')
      onAfter?.()
    })
  } catch {
    location.href = url
  } finally {
    busy = false
  }
}

export function mountTransit(): void {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || !isSoftTarget(a)) return
      e.preventDefault()
      void hop(a.href, { push: true })
    },
    true,
  )
  window.addEventListener('popstate', () => {
    void hop(location.href, { push: false })
  })
}
