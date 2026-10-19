import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
      ],
      // NestJS modules are decorated classes without members by design.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.int-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      // `expect(() => voidFn())` and supertest's untyped `response.body` are idiomatic in tests.
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
