import type { Me } from '../types/api'
import { resolveMediaUrl } from '../lib/api'

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const

function avatarInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

type UserAvatarProps = {
  user: Pick<Me, 'email' | 'profile_picture_url' | 'effective_display_name' | 'display_name'>
  size?: keyof typeof SIZE_CLASS
  className?: string
}

export function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  const displayName = user.effective_display_name || user.display_name || user.email
  const imageUrl = resolveMediaUrl(user.profile_picture_url)
  const initials = avatarInitials(displayName, user.email)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-2 ring-violet-500/30 ${SIZE_CLASS[size]} ${className}`}
      />
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-violet-600/80 font-semibold text-white ring-2 ring-violet-500/30 ${SIZE_CLASS[size]} ${className}`}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function userDisplayName(user: Pick<Me, 'email' | 'effective_display_name' | 'display_name'>): string {
  return user.effective_display_name || user.display_name?.trim() || user.email.split('@')[0] || user.email
}
