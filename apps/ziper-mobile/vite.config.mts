import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';
import { jestCompatSetup, jestMockTransform } from 'vitest-native/jest-compat';

function nativeConfig(platform: 'ios' | 'android') {
  return defineConfig({
    root: import.meta.dirname,
    plugins: [
      // These tests do not use the production Unistyles Babel plugin.
      reactNative({
        engine: 'native',
        platform,
        presets: { navigation: false },
        registryBuild: 'wait',
        projectBabel: 'never',
      }),
      jestMockTransform(),
    ],
    test: {
      name: `mobile-${platform}`,
      env: { TEST_NATIVE_PLATFORM: platform },
      include: ['test/**/*.test.{ts,tsx}'],
      globals: true,
      setupFiles: [jestCompatSetup],
      fileParallelism: false,
      maxWorkers: 1,
      testTimeout: 10000,
      hookTimeout: 20000,
      restoreMocks: true,
    },
  });
}

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'mobile-unit', include: ['src/**/*.test.{ts,tsx}'] } },
      nativeConfig('ios'),
      nativeConfig('android'),
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 20000,
    restoreMocks: true,
  },
});
