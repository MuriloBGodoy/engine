import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Código que roda em Node, não no navegador: funções da Netlify, scripts de
  // verificação e configs.
  //
  // Sem isto o eslint aplicava `globals.browser` neles e não conhecia `process`
  // nem `Buffer` — 12 erros fantasma, todos "process is not defined", que
  // escondiam erro real no código de pagamento por ruído.
  //
  // Os `.mjs` também não eram lintados de forma alguma: o único bloco existente
  // casava só `{js,jsx}`, e em flat config arquivo sem bloco não é analisado.
  // Ou seja: os scripts de verificação nunca tinham passado pelo lint.
  {
    files: [
      'netlify/**/*.{js,mjs}',
      'scripts/**/*.{js,mjs}',
      '*.config.js',
      'create-test-event.js',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
