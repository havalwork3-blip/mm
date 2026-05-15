import QRCode from 'qrcode'

export type QrWithLogoOptions = {
  width?: number
  margin?: number
  dark?: string
  light?: string
  /** 0–1 fraction of QR width used for the centered logo (default 0.22). */
  logoSizeRatio?: number
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const trimmed = src.trim()
    if (!trimmed) {
      reject(new Error('empty image src'))
      return
    }
    const img = new Image()
    if (!trimmed.startsWith('blob:') && !trimmed.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img)
        return
      }
      reject(new Error('invalid image dimensions'))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = trimmed
  })
}

async function compositeLogoOnQrDataUrl(
  qrDataUrl: string,
  logoSrc: string,
  light: string,
  logoSizeRatio: number,
): Promise<string> {
  const [qrImg, logoImg] = await Promise.all([
    loadImageElement(qrDataUrl),
    loadImageElement(logoSrc),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = qrImg.naturalWidth
  canvas.height = qrImg.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('no canvas context')
  }

  ctx.drawImage(qrImg, 0, 0)

  const ratio = Math.min(Math.max(logoSizeRatio, 0.12), 0.3)
  const logoSize = Math.floor(canvas.width * ratio)
  const pad = Math.max(4, Math.floor(logoSize * 0.1))
  const x = (canvas.width - logoSize) / 2
  const y = (canvas.height - logoSize) / 2

  ctx.fillStyle = light
  ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2)
  ctx.drawImage(logoImg, x, y, logoSize, logoSize)

  return canvas.toDataURL('image/png')
}

/**
 * Builds a QR data URL. When `logoSrc` is set and loads successfully, draws the logo in the center.
 * On any logo/canvas failure, returns the plain QR so callers never need to throw.
 */
export async function qrToDataUrlWithOptionalLogo(
  text: string,
  logoSrc: string | null | undefined,
  options: QrWithLogoOptions = {},
): Promise<string> {
  const width = options.width ?? 220
  const margin = options.margin ?? 2
  const dark = options.dark ?? '#1a1410'
  const light = options.light ?? '#faf6f0'
  const logo = logoSrc?.trim() || null

  const base = await QRCode.toDataURL(text, {
    width,
    margin,
    errorCorrectionLevel: logo ? 'H' : 'M',
    color: { dark, light },
  })

  if (!logo) return base

  try {
    return await compositeLogoOnQrDataUrl(base, logo, light, options.logoSizeRatio ?? 0.22)
  } catch {
    return base
  }
}
