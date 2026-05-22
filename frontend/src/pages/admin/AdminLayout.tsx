import { Navigate, Outlet } from 'react-router-dom'
import { useLocale } from '../../context/LocaleContext'
import { useSession } from '../../context/SessionContext'

export function AdminLayout() {
  const { t } = useLocale()
  const { me, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        {t('common.loading')}
      </div>
    )
  }

  if (!me?.is_superuser) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      <Outlet />
    </div>
  )
}
