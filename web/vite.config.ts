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
  },
})
