/** Animate a dot from a button/image toward the cart icon. */
export function triggerCartFly(fromEl: HTMLElement | null, accent: string): void {
  if (!fromEl || typeof document === 'undefined') return
  const cart =
    document.getElementById('sf-cart-anchor') ??
    document.getElementById('sf-cart-anchor-desktop')
  if (!cart) return

  const from = fromEl.getBoundingClientRect()
  const to = cart.getBoundingClientRect()
  const size = Math.min(48, Math.max(28, from.width * 0.35))
  const x0 = from.left + from.width / 2 - size / 2
  const y0 = from.top + from.height / 2 - size / 2
  const x1 = to.left + to.width / 2 - size / 2
  const y1 = to.top + to.height / 2 - size / 2

  const el = document.createElement('div')
  el.className = 'sf-fly-particle'
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.style.background = accent
  el.style.setProperty('--sf-x0', `${x0}px`)
  el.style.setProperty('--sf-y0', `${y0}px`)
  el.style.setProperty('--sf-x1', `${x1}px`)
  el.style.setProperty('--sf-y1', `${y1}px`)
  document.body.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })

  window.dispatchEvent(new CustomEvent('sf-cart-pulse'))
}
