import { defineConfig } from 'vitest/config';

// The checks for the app's own logic: syncing, answers, the lock, updates.
// Plain Node, no browser - the code under test needs only a window that is the
// global object and localStorage, which src/test/setup.ts provides.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // The vault derives its key with 600,000 PBKDF2 rounds on purpose.
    testTimeout: 30_000
  }
});
