import { Component, Suspense, type ReactNode } from 'react'

function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-violet-600" />
    </div>
  )
}

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <p>
          ئەم بەشە نەکرایەوە. پەیوەندی ئینتەرنێت بپشکنە.
          <br />
          This page could not be loaded. Check the internet connection.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white"
        >
          دووبارە هەوڵ بدەرەوە / Try again
        </button>
      </div>
    )
  }
}

/** Suspense + error boundary for lazily loaded pages (keeps the surrounding layout visible). */
export function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </PageErrorBoundary>
  )
}
