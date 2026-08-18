import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // Chakra 공식 Vite 가이드 — Vite 8+ 에서는 이 옵션으로 tsconfig 의 paths 를 그대로 쓴다
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // 화면 테스트는 MSW 왕복과 스프링 전환을 함께 기다린다. RTL 대기(5초)보다 넉넉해야 한다.
    testTimeout: 20_000,
  },
})
