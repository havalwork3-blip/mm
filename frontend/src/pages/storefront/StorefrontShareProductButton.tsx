import { Check, Link2, Share2 } from 'lucide-react'
import { useState } from 'react'

import { buildProductShareUrl } from './storefrontProductUrl'
import { accentAlpha } from './storefrontTheme'

type Props = {
  productId: number
  productName: string
  accent: string
  shareLabel: string
  linkCopiedLabel: string
}

export function StorefrontShareProductButton({
  productId,
  productName,
  accent,
  shareLabel,
  linkCopiedLabel,
}: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = buildProductShareUrl(productId)
    if (!url) return
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: productName, url })
        return
      }
    } catch {
      /* user cancelled or unsupported */
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50"
      style={{ borderColor: accentAlpha(accent, 0.35), color: accent }}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden />
      )}
      {copied ? linkCopiedLabel : shareLabel}
      {!copied && typeof navigator !== 'undefined' && !navigator.share ? (
        <Link2 className="h-3.5 w-3.5 opacity-60" aria-hidden />
      ) : null}
    </button>
  )
}
