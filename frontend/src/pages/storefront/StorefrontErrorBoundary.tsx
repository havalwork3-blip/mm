import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class StorefrontErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[storefront]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#faf8f5] px-6 text-center">
          <p className="text-base font-bold text-slate-800">Something went wrong</p>
          <p className="max-w-sm text-sm text-slate-500">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
