import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.artifacts/**',
      'sdk/generated/**',
      'protocol/generated/**',
      'docs/generated/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.base],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
          message: 'Unchecked cast to unknown is rejected.',
        },
      ],
    },
  },
);
