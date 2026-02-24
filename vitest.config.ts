import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          globals: true,
          include: ['src/**/*.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, './apps/web/src'),
          },
        },
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
})
