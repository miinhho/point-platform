import { useQuery, useQueryClient } from '@tanstack/react-query'
import { read, walletQuery } from '@/shared/api'
import { useSession } from '@/features/auth'
import type { User } from '@/shared/contract'

export interface SettingsPageView {
  me: User | null
  signOut: () => void
}

export function useSettingsPage(): SettingsPageView {
  const wallet = read(useQuery(walletQuery()))
  const { signOut } = useSession()
  return { me: wallet.data?.user ?? null, signOut }
}

/**
 * 개발 패널이 지연·실패를 바꾼 뒤 화면이 그것을 곧바로 겪게 한다.
 * `src/mocks/` 만 만지므로 실서버로 바꾸면 함께 사라진다.
 */
export function useInvalidateAll(): () => void {
  const client = useQueryClient()
  return () => void client.invalidateQueries()
}
