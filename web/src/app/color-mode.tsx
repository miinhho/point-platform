'use client'

import { ThemeProvider, useTheme } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

/** 3택이어야 한다. 2택 토글은 시스템 따르기로 돌아갈 길을 없앤다. */
export interface ColorModeProviderProps extends ThemeProviderProps {}

export function ColorModeProvider(props: ColorModeProviderProps) {
  return <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
}

/** 사용자가 고를 수 있는 값. 'system' 이 기본이고 언제든 되돌아올 수 있다. */
export type ColorModePreference = 'system' | 'light' | 'dark'
/** 실제로 적용된 값 */
export type ColorMode = 'light' | 'dark'

export interface UseColorModeReturn {
  /** 사용자가 고른 값 ('system' 포함) */
  preference: ColorModePreference
  /** 실제로 적용된 값 */
  colorMode: ColorMode
  setPreference: (preference: ColorModePreference) => void
}

export function useColorMode(): UseColorModeReturn {
  const { theme, resolvedTheme, forcedTheme, setTheme } = useTheme()
  return {
    preference: (forcedTheme ?? theme ?? 'system') as ColorModePreference,
    colorMode: (forcedTheme ?? resolvedTheme ?? 'light') as ColorMode,
    setPreference: setTheme,
  }
}

export function useColorModeValue<T>(light: T, dark: T): T {
  return useColorMode().colorMode === 'dark' ? dark : light
}
