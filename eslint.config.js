// ESLint flat config —— 只做静态兜底，不参与构建、不影响运行时。
// 规则取向：真正的错误（未定义标识符、重复声明、不可达代码）报 error；
// 风格类与历史遗留（未使用变量、空块）降为 warn，保证 `npm run lint` 零 error。

const browserGlobals = {
  window: 'readonly', document: 'readonly', console: 'readonly', location: 'readonly',
  navigator: 'readonly', performance: 'readonly', screen: 'readonly', history: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', self: 'readonly', top: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  queueMicrotask: 'readonly', structuredClone: 'readonly',
  fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
  FileReader: 'readonly', FormData: 'readonly', Headers: 'readonly', Request: 'readonly', Response: 'readonly',
  Image: 'readonly', ImageBitmap: 'readonly', createImageBitmap: 'readonly', OffscreenCanvas: 'readonly',
  Audio: 'readonly', AudioContext: 'readonly', webkitAudioContext: 'readonly',
  HTMLElement: 'readonly', HTMLCanvasElement: 'readonly', HTMLImageElement: 'readonly',
  HTMLVideoElement: 'readonly', HTMLInputElement: 'readonly', HTMLSelectElement: 'readonly',
  CanvasRenderingContext2D: 'readonly', WebGLRenderingContext: 'readonly', WebGL2RenderingContext: 'readonly',
  Event: 'readonly', CustomEvent: 'readonly', KeyboardEvent: 'readonly', MouseEvent: 'readonly',
  PointerEvent: 'readonly', WheelEvent: 'readonly', TouchEvent: 'readonly', DragEvent: 'readonly',
  ResizeObserver: 'readonly', IntersectionObserver: 'readonly', MutationObserver: 'readonly',
  DOMParser: 'readonly', XMLHttpRequest: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
  atob: 'readonly', btoa: 'readonly', crypto: 'readonly', devicePixelRatio: 'readonly',
  innerWidth: 'readonly', innerHeight: 'readonly', matchMedia: 'readonly', getComputedStyle: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly', open: 'readonly', close: 'readonly',
  DOMRect: 'readonly', Node: 'readonly', NodeList: 'readonly', Element: 'readonly',
  getSelection: 'readonly', scrollTo: 'readonly', focus: 'readonly', blur: 'readonly',
  MediaQueryList: 'readonly', WebSocket: 'readonly', Worker: 'readonly',
  addEventListener: 'readonly', removeEventListener: 'readonly', dispatchEvent: 'readonly',
  speechSynthesis: 'readonly', SpeechSynthesisUtterance: 'readonly',
  Option: 'readonly', Path2D: 'readonly', ImageData: 'readonly', DOMMatrix: 'readonly',
  FontFace: 'readonly', WebGLProgram: 'readonly', WebGLShader: 'readonly',
};

const nodeGlobals = {
  process: 'readonly', Buffer: 'readonly', __dirname: 'readonly', __filename: 'readonly',
  module: 'writable', require: 'readonly', exports: 'writable', global: 'readonly',
  console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', setImmediate: 'readonly',
  URL: 'readonly', URLSearchParams: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
  fetch: 'readonly', AbortController: 'readonly', performance: 'readonly', structuredClone: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**', 'vendor/**', 'assets/**', 'dist/**', 'tests/e2e/shots/**',
      'tools/tripo/out/**', 'tripo-out/**', 'tools/assets/blender/**', '.layertest/**',
      // 本地缓存与实验产物：.cache/autoresearch/ 是跑分 JSON 与截图，
      // .cache/ 下的一次性探针脚本也算 —— lint 生成物只会让门禁被它们搞红
      '.cache/**', '.layertest/**', 'coverage/**', '**/*.min.js',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-func-assign': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-async-promise-executor': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-fallthrough': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'no-misleading-character-class': 'warn',
      'no-control-regex': 'warn',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.mjs', 'tools/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...nodeGlobals } },
  },
];
