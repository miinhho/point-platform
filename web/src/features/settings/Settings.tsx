import { Box, Text, chakra } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useColorMode, type ColorModePreference } from '@/app/color-mode'
import { Body, Gutter, Header, Screen, Title } from '@/shared/ui/Screen'

const Chip = chakra('button', {
  base: {
    paddingInline: '3',
    paddingBlock: '1.5',
    borderRadius: 'full',
    textStyle: 'caption',
    borderWidth: '1px',
    borderColor: 'border',
  },
  variants: {
    selected: { true: { borderColor: 'fg', textStyle: 'label', color: 'fg' } },
  },
})

const MODES: ColorModePreference[] = ['system', 'light', 'dark']

/** 3택이어야 한다. 2택 토글은 시스템 따르기로 돌아갈 길을 없앤다. */
export function Settings() {
  const { t } = useTranslation()
  const { preference, setPreference } = useColorMode()

  const label = {
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
        <Gutter paddingTop="4">
          <Text textStyle="caption">{t('settings.colorMode')}</Text>
          <Box
            role="radiogroup"
            aria-label={t('settings.colorMode')}
            display="flex"
            gap="2"
            marginTop="2"
          >
            {MODES.map((mode) => (
              <Chip
                key={mode}
                type="button"
                role="radio"
                aria-checked={preference === mode}
                selected={preference === mode}
                onClick={() => setPreference(mode)}
              >
                {label[mode]}
              </Chip>
            ))}
          </Box>
        </Gutter>
      </Body>
    </Screen>
  )
}
