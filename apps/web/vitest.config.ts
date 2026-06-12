import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // renderHook(@testing-library/react)용
  },
});
