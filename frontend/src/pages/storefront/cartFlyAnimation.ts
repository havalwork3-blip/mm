export type CartFlyOptions = {
  /** Product thumbnail for the flying particle */
  imageUrl?: string | null
}

function resolveCartFlyTarget(): HTMLElement | null {
  const nudge = document.getElementById('sf-view-cart-nudge-btn')
  const productOpen = document.documentElement.classList.contains('sf-product-open')
  if (nudge && (productOpen || nudge.offsetParent !== null)) return nudge

  const mobile = document.getElementById('sf-cart-anchor-mobile')
  if (mobile && mobile.offsetParent !== null) return mobile

  const desktop = document.getElementById('sf-cart-anchor-desktop')
  if (desktop && desktop.offsetParent !== null) return desktop

  return document.getElementById('sf-cart-anchor-mobile') ?? document.getElementById('sf-cart-anchor-desktop')
}

function runCartFly(
  fromEl: HTMLElement,
  accent: string,
  options?: CartFlyOptions,
): void {
  const cart = resolveCartFlyTarget()
  if (!cart) return

  const from = fromEl.getBoundingClientRect()
  const to = cart.getBoundingClientRect()
  const size = Math.min(56, Math.max(32, from.width * 0.4))
  const x0 = from.left + from.width / 2 - size / 2
  const y0 = from.top + from.height / 2 - size / 2
  const x1 = to.left + to.width / 2 - size / 2
  const y1 = to.top + to.height / 2 - size / 2
  const midX = (x0 + x1) / 2
  const midY = Math.min(y0, y1) - Math.min(72, window.innerHeight * 0.12)

  const el = document.createElement('div')
  el.className = ['sf-fly-particle', options?.imageUrl ? 'sf-fly-particle--img' : ''].filter(Boolean).join(' ')
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  if (options?.imageUrl) {
    el.style.backgroundImage = `url(${options.imageUrl})`
  } else {
    el.style.background = accent
  }
  el.style.setProperty('--sf-x0', `${x0}px`)
  el.style.setProperty('--sf-y0', `${y0}px`)
  el.style.setProperty('--sf-xm', `${midX}px`)
  el.style.setProperty('--sf-ym', `${midY}px`)
  el.style.setProperty('--sf-x1', `${x1}px`)
  el.style.setProperty('--sf-y1', `${y1}px`)
  document.body.appendChild(el)
  el.addEventListener(
    'animationend',
    () => {
      el.remove()
      window.dispatchEvent(new CustomEvent('sf-cart-pulse'))
      window.dispatchEvent(new CustomEvent('sf-nudge-pulse'))
    },
    { once: true },
  )
}

/** Animate from button toward cart / floating «view cart» nudge. */
export function triggerCartFly(
  fromEl: HTMLElement | null,
  accent: string,
  options?: CartFlyOptions,
): void {
  if (!fromEl || typeof document === 'undefined') return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => runCartFly(fromEl, accent, options))
  })
}
