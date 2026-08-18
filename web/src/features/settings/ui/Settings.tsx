import { Box, Button, Text } from '@chakra-ui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { walletQuery } from '@/api/queries'
import { useSession } from '@/features/auth'
import { useColorMode, type ColorModePreference } from '@/app/color-mode'
import { resetLedger } from '@/mocks/ledger'
import { resetSim, setSim } from '@/mocks/sim'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'
import type { FailureCode } from '@/domain/types'

function Chip({
  selected,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & { selected?: boolean }) {
  return (
    <Button size="xs" borderRadius="full" variant={selected ? 'subtle' : 'outline'} {...rest}>
      {children}
    </Button>
  )
}

const MODES: ColorModePreference[] = ['system', 'light', 'dark']

export function Settings() {
  const { t } = useTranslation()
  const { preference, setPreference } = useColorMode()
  const { data } = useQuery(walletQuery())
  const { signOut } = useSession()

  const modeLabel = {
    system: t('settings.colorModeSystem'),
    light: t('settings.colorModeLight'),
    dark: t('settings.colorModeDark'),
  }

  return (
    <Screen>
      <Header>
        <Title>{t('settings.title')}</Title>
      </Header>

      <Body>
        <Section label={t('settings.account')}>
          {/* 내가 누구인지 화면에 없으면 잘못된 계정에서 보내는 실수를 알 수 없다 */}
          <Box display="flex" alignItems="baseline" gap="2">
            <Text textStyle="name">{data?.user.name ?? ''}</Text>
            <Text textStyle="handle">{data?.user.handle ?? ''}</Text>
          </Box>
          <Button
            size="xs"
            variant="outline"
            marginTop="3"
            onClick={() => {
              // 서버 토큰을 버리고 캐시를 지운다. 남기면 다음 사람이 내 잔액을 본다.
              signOut()
            }}
          >
            {t('auth.logout')}
          </Button>
        </Section>

        <Section label={t('settings.colorMode')}>
          <Box role="radiogroup" aria-label={t('settings.colorMode')} display="flex" gap="2">
            {MODES.map((mode) => (
              <Chip
                key={mode}
              
                role="radio"
                aria-checked={preference === mode}
                selected={preference === mode}
                onClick={() => setPreference(mode)}
              >
                {modeLabel[mode]}
              </Chip>
            ))}
          </Box>
        </Section>

        <DevPanel />
      </Body>
    </Screen>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Gutter paddingTop="5">
      <Text textStyle="caption">{label}</Text>
      <Box marginTop="2">{children}</Box>
    </Gutter>
  )
}

const LATENCIES = [
  { key: 'devLatencyInstant', value: 0 },
  { key: 'devLatencyNormal', value: 400 },
  { key: 'devLatencySlow', value: 2500 },
] as const

const FAILURES = [
  { key: 'devFailureNone', code: null, lost: false },
  { key: 'devFailureNetwork', code: 'NETWORK' as FailureCode, lost: false },
  { key: 'devFailureServer', code: 'SERVER' as FailureCode, lost: false },
  { key: 'devFailureLost', code: null, lost: true },
] as const

/**
 * 실패를 넣을 수 없으면 정직함을 시험할 수 없다.
 * `src/mocks/` 만 만지므로 실서버로 바꾸면 이 컴포넌트가 함께 사라진다.
 */
function DevPanel() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [latency, setLatency] = useState(400)
  const [failure, setFailure] = useState('devFailureNone')

  return (
    <>
      <Section label={t('settings.dev')}>
        <Box display="flex" gap="2">
          {LATENCIES.map(({ key, value }) => (
            <Chip
              key={key}
            
              selected={latency === value}
              onClick={() => {
                setLatency(value)
                setSim({ latencyMs: value, jitterMs: value === 0 ? 0 : 200 })
              }}
            >
              {t(`settings.${key}`)}
            </Chip>
          ))}
        </Box>
      </Section>

      <Section label={t('settings.devFailure')}>
        <Box display="flex" flexWrap="wrap" gap="2">
          {FAILURES.map(({ key, code, lost }) => (
            <Chip
              key={key}
            
              selected={failure === key}
              onClick={() => {
                setFailure(key)
                setSim({ forceFailure: code, loseNextResponse: lost })
              }}
            >
              {t(`settings.${key}`)}
            </Chip>
          ))}
        </Box>
      </Section>

      <Section label={t('settings.devReset')}>
        <Chip
        
          onClick={() => {
            resetLedger()
            resetSim()
            setFailure('devFailureNone')
            setLatency(400)
            void client.invalidateQueries()
          }}
        >
          {t('settings.devReset')}
        </Chip>
        <Text textStyle="caption" marginTop="3">
          {t('settings.devNote')}
        </Text>
      </Section>
    </>
  )
}
