import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, authApi, type Session } from '@/shared/api'
import { useSession } from './session'

export interface SignInForm {
  handle: string
  setHandle: (value: string) => void
  password: string
  setPassword: (value: string) => void
  submit: () => void
  busy: boolean
  error: ApiError | null
}

/** 로그인하지 않으면 어떤 화면도 보이지 않는다. 남의 잔액을 보여줄 경로를 만들지 않는다 */
export function useSignIn(): SignInForm {
  const { signIn } = useSession()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation<Session, Error, void>({
    // 핸들은 서버가 정규화한다. 입력을 그대로 보낸다 — 계약: docs/API.md
    mutationFn: () => authApi.login({ handle, password }),
    retry: false,
    onSuccess: (session) => signIn(session),
  })

  return {
    handle,
    setHandle,
    password,
    setPassword,
    submit: () => login.mutate(),
    busy: login.isPending,
    error: login.error instanceof ApiError ? login.error : null,
  }
}
