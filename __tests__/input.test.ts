import * as input from '../src/input.js';

const testEnvVars = {
  INPUT_TOOLCHAIN: '+nightly',
  // There are few unnecessary spaces here to check that args parser works properly
  INPUT_ARGS: '    --feature-powerset   --no-deps     ',
  'INPUT_WORKING-DIRECTORY': 'rust_tests/clippy_warnings',
  INPUT_TOOL: 'cargo-hack',
  'INPUT_CACHE-KEY': 'rs-clippy-check-tests',
};

describe('input', () => {
  beforeEach(() => {
    for (const key in testEnvVars) {
      process.env[key] = testEnvVars[key as keyof typeof testEnvVars];
    }
  });

  it('Parses action input into rs-clippy-check input', () => {
    const result = input.get();

    expect(result.toolchain).toBe('nightly');
    expect(result.args).toStrictEqual(['--feature-powerset', '--no-deps']);
    expect(result.workingDirectory).toBe('rust_tests/clippy_warnings');
    expect(result.tool).toBe('cargo-hack');
    expect(result.cacheKey).toBe('rs-clippy-check-tests');
  });
});
