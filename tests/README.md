# Test Infrastructure

## Overview

This project uses **Jest** with **JSDOM** for testing. The test suite covers:
- Unit tests for validators and masking functions
- Integration tests for end-to-end detection workflows
- Mocked Chrome extension APIs

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/               # Unit tests for individual functions
│   ├── validators.test.js
│   └── maskRules.test.js
├── integration/        # Integration tests for workflows
│   └── detection.test.js
├── mocks/             # Mock implementations
│   └── chrome.js      # Chrome extension API mocks
├── utils/             # Test utilities
│   └── testHelpers.js # Helper functions for tests
└── setup.js           # Global test setup
```

## Writing Tests

### Unit Test Example

```javascript
import { describe, test, expect } from '@jest/globals';
import { maskAadhaar } from '../../src/utils/maskRules.js';

describe('Aadhaar Masking', () => {
  test('masks Aadhaar showing last 4 digits', () => {
    expect(maskAadhaar('423456789012')).toBe('XXXXXXXX9012');
  });
});
```

### Integration Test Example

```javascript
import { detectPIIWithRegex } from '../../src/utils/regexPatterns.js';
import { maskText } from '../../src/utils/maskRules.js';

test('full workflow: detect → mask → verify', () => {
  const text = 'Phone: 9876543210';

  const detection = detectPIIWithRegex(text, 0.6);
  expect(detection.piiDetected).toBe(true);

  const masked = maskText(text, detection.matches);
  expect(masked).toContain('98****210');
});
```

## Test Helpers

Use the provided test helpers in `tests/utils/testHelpers.js`:

```javascript
import {
  createContentEditableElement,
  createMockSettings,
  createMockMatch,
  assertNoExtraWhitespace
} from '../utils/testHelpers.js';

// Create test elements
const element = createContentEditableElement('test content');

// Create mock data
const settings = createMockSettings({ minConfidence: 0.8 });
const match = createMockMatch('phone', '9876543210', 0, 0.9);

// Assert whitespace
assertNoExtraWhitespace('no  double  spaces');
```

## Coverage Goals

- **Statements:** 50%+ (increase over time)
- **Branches:** 40%+
- **Functions:** 40%+
- **Lines:** 50%+

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## CI/CD Integration

Tests run automatically on:
- Every `git push` to `main` or `develop`
- Every pull request

See `.github/workflows/ci.yml` for configuration.

## Pre-commit Hooks

Before committing, run:
```bash
npm run precommit
```

This runs tests and builds the extension to catch issues early.

## Debugging Tests

### Run specific test file
```bash
npm test -- tests/unit/validators.test.js
```

### Run specific test by name
```bash
npm test -- -t "validates correct Aadhaar"
```

### Enable verbose output
```bash
npm test -- --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Issues

### ES Modules Error
If you see `Cannot use import statement outside a module`:
- Ensure `NODE_OPTIONS=--experimental-vm-modules` is in the npm script
- Check `jest.config.js` has `extensionsToTreatAsEsm: ['.js']`

### Chrome API Not Mocked
If you see `chrome is not defined`:
- Import the mock: `import chrome from '../mocks/chrome.js'`
- Or use the auto-imported global in `tests/setup.js`

### Async Test Timeout
If tests timeout:
- Increase `testTimeout` in `jest.config.js`
- Or add timeout to specific test: `test('name', async () => {...}, 15000)`

## Best Practices

1. **Test behavior, not implementation**
   - ✅ `expect(masked).not.toContain('9876543210')`
   - ❌ `expect(maskPhone.mock.calls.length).toBe(1)`

2. **Use descriptive test names**
   - ✅ `test('masks Aadhaar preserving original formatting')`
   - ❌ `test('masking works')`

3. **One assertion per test (when possible)**
   - Helps identify exactly what failed

4. **Clean up after tests**
   ```javascript
   afterEach(() => {
     cleanupElement(element);
   });
   ```

5. **Mock external dependencies**
   - Chrome APIs
   - Network requests
   - File system operations

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [JSDOM](https://github.com/jsdom/jsdom)
