import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs'],
  },
  // Global linter options
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  // Base recommended rules
  eslint.configs.recommended,
  // TypeScript rules (non-type-checked for compatibility)
  ...tseslint.configs.recommended,
  // Prettier integration
  prettier,
  // Source files with type-aware linting
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  // Test files - no type-aware linting needed
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-expressions': 'off', // Allow chai assertions
      'no-unused-expressions': 'off', // Allow chai assertions
    },
  },
)
