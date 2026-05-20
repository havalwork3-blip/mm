import { apiJson } from '../lib/api'

export type TranslateFromKurdishResult = {
  ar: string
  en: string
}

export async function translateFromKurdish(text: string): Promise<TranslateFromKurdishResult> {
  return apiJson<TranslateFromKurdishResult>('/api/translate/', {
    method: 'POST',
    body: JSON.stringify({ text: text.trim() }),
  })
}
