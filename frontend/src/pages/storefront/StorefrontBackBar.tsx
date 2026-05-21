import { ArrowRight } from 'lucide-react'

type Props = {
  label: string
  onClick: () => void
  className?: string
}

export function StorefrontBackBar({ label, onClick, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'sf-back-bar group flex max-w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-start text-sm font-bold shadow-sm ring-1 transition active:scale-[0.98] sm:px-3 sm:py-2.5',
        className,
      ].join(' ')}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-200">
        <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
      </span>
      <span className="truncate text-slate-700">{label}</span>
    </button>
  )
}
