'use client'

import { ThemeProvider, useTheme } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

/**
 * 색 모드.
 *
 * 기본은 시스템 설정을 따르되, 사용자가 앱 안에서 재정의할 수 있다 (헌법 15조).
 * 시스템은 다크로 두면서 이 앱만 라이트로 보려는 사용자가 실제로 있고,
 * 금융 앱은 숫자 가독성 선호가 특히 강하다.
 *
 * 반드시 3택이다. 라이트↔다크 토글로 만들면 한 번 누른 사용자가
 * **시스템 따르기로 돌아갈 방법을 잃는다.** 이후 시스템 설정을 바꿔도 앱이
 * 따라오지 않고, 그 상태를 되돌릴 수 없다.
 *
 * 이 파일은 Chakra CLI 스니펫에서 아이콘 버튼 UI 만 덜어낸 것이다. 그 UI 는
 * react-icons 의존성을 끌고 오고 우리 디자인 언어와도 맞지 않으므로 직접 만든다.
 */
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
