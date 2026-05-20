const globals = require('globals');
const html = require('eslint-plugin-html');

const sharedRules = {
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-cond-assign': ['error', 'except-parens'],
  'no-fallthrough': 'error',
  'valid-typeof': 'error',
  'use-isnan': 'error',
};

module.exports = [
  {
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: { ...sharedRules },
  },
  {
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        io: 'readonly',
      },
    },
    rules: {
      ...sharedRules,
      // Inline-script top-level functions are the page's public API, invoked
      // from HTML `onclick=`/`onchange=` attributes that the HTML processor
      // cannot see. Only check unused vars in local scope to avoid false
      // positives on those handlers.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', vars: 'local' }],
    },
  },
];
