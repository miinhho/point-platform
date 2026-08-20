import { Box, Button, Field, Input, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { failureTitleKey } from '@/shared/i18n/keys'
import { Body, Gutter, Screen } from '@/shared/ui/Screen'
import { useSignIn } from '../model/useSignIn'

/** 로그인하지 않으면 어떤 화면도 보이지 않는다. 남의 잔액을 보여줄 경로를 만들지 않는다. */
export function SignIn() {
  const { t } = useTranslation()
  const { handle, setHandle, password, setPassword, submit, busy, error } = useSignIn()

  return (
    <Screen>
      <Body>
        <Gutter paddingTop="open">
          <Text textStyle="headline">{t('auth.title')}</Text>
          <Text textStyle="support">{t('auth.subtitle')}</Text>

          <Box
            asChild
            marginTop="part"
            display="flex"
            flexDirection="column"
            gap="side"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit()
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
                <Text role="alert" textStyle="support" color="failed.fg">
                  {t(failureTitleKey(error.code))}
                </Text>
              ) : null}

              <Button
                type="submit"
                size="xl"
                width="full"
                marginTop="tight"
                loading={busy}
                disabled={handle.trim() === '' || password === ''}
              >
                {t('auth.submit')}
              </Button>
            </form>
          </Box>

          <Text textStyle="caption" marginTop="block">
            {t('auth.hint')}
          </Text>
        </Gutter>
      </Body>
    </Screen>
  )
}
