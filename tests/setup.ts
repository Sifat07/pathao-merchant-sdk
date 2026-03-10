// Jest setup file
// Add any global test setup here

// Suppress console output during tests without replacing global.console,
// so that errors thrown inside console methods are still catchable.
let consoleSpy: { log: jest.SpyInstance; warn: jest.SpyInstance; error: jest.SpyInstance };

beforeAll(() => {
  consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
});

afterAll(() => {
  consoleSpy.log.mockRestore();
  consoleSpy.warn.mockRestore();
  consoleSpy.error.mockRestore();
});
