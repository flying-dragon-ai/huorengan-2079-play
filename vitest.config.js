// Vitest：只跑纯逻辑单测，不依赖 WebGL / DOM。
// three 与 three/addons 走 importmap 同款别名，指向 vendored r187。
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three\/addons\/(.*)$/, replacement: root + 'vendor/three/addons/$1' },
      { find: /^three$/, replacement: root + 'vendor/three/three.module.js' },
    ],
  },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    testTimeout: 20000,
  },
});
