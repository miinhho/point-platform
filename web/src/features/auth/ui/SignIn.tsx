import { Box, Button, Field, Input, Text } from '@chakra-ui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endpoints, type Session } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { failureTitleKey } from '@/domain/failures'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'
import { useSession } from '../model/session'

/** 로그인하지 않으면 어떤 화면도 보이지 않는다. 남의 잔액을 보여줄 경로를 만들지 않는다. */
export function SignIn() {
  const { t } = useTranslation()
  const { signIn } = useSession()
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation<Session, Error, void>({
    mutationFn: () => endpoints.login({ handle, password }),
    retry: false,
    onSuccess: (session) => signIn(session),
  })

  const error = login.error instanceof ApiError ? login.error : null

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="16">
          <Text textStyle="headline">{t('auth.title')}</Text>
          <Text textStyle="support">{t('auth.subtitle')}</Text>

          <Box
            asChild
            marginTop="8"
            display="flex"
            flexDirection="column"
            gap="3"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                login.mutate()
              }}
            >
              <Field.Root>
                <Field.Label>{t('auth.handle')}</Field.Label>
                <Input
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder={t('auth.handlePlaceholder')}
                  name="username"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  size="lg"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>{t('auth.password')}</Field.Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  name="password"
                  autoComplete="current-password"
                  size="lg"
                />
              </Field.Root>

              {error ? (
                <Text role="alert" textStyle="support" color="red.fg">
                  {t(failureTitleKey(error.code))}
                </Text>
              ) : null}

              <Button
                type="submit"
                size="xl"
                width="full"
                marginTop="2"
                loading={login.isPending}
                disabled={handle.trim() === '' || password === ''}
              >
                {t('auth.submit')}
              </Button>
            </form>
          </Box>

          <Text textStyle="caption" marginTop="6">
            {t('auth.hint')}
          </Text>
        </Gutter>
      </Body>
    </Screen>
  )
}
