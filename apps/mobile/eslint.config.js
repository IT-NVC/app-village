// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Monorepo: giải quyết alias "@/..." và package "@thon/shared" theo tsconfig
    // TypeScript đã kiểm tra tên export; quy tắc này báo nhầm với một số module Expo
    rules: { 'import/namespace': 'off' },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
  },
]);
