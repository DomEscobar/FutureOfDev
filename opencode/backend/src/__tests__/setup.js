// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
