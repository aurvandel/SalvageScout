import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // The default worker_threads pool segfaults intermittently in
      // resource-constrained containers (e.g. CI with a small /dev/shm).
      // Forked child processes don't share that limitation.
      pool: 'forks',
    },
  }),
)
