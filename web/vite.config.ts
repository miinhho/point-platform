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
  // `VITE_API_ORIGIN` 이 있으면 `/api` 를 그 서버로 넘긴다. 앱의 기준 경로가
  // `${origin}/api` 라 프록시 없이는 dev 서버 자신에게 간다 — 계약: docs/API.md
  server: {
    proxy: process.env.VITE_API_ORIGIN
      ? { '/api': { target: process.env.VITE_API_ORIGIN, changeOrigin: true } }
      : undefined,
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    // 화면 테스트는 MSW 왕복과 스프링 전환을 함께 기다린다. RTL 대기(5초)보다 넉넉해야 한다.
    testTimeout: 20_000,
  },
})
