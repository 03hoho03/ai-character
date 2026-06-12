import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic', // tsconfig은 Next용 jsx:preserve — 테스트의 .tsx는 esbuild가 변환
  },
  test: {
    environment: 'jsdom', // renderHook(@testing-library/react)용
  },
});
