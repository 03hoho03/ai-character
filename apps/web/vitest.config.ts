import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic', // tsconfig은 Next용 jsx:preserve — 테스트의 .tsx는 esbuild가 변환
  },
  resolve: {
    // tsconfig paths의 '@/*' → src — 컴포넌트 테스트가 절대 import를 해석하게
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom', // renderHook(@testing-library/react)용
  },
});
