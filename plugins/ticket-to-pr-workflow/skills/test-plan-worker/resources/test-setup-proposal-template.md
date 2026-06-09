# Test Setup Proposal

## Current Test Environment

{{detectedTestEnvironment}}

## Missing Test Setup

{{missingTestSetup}}

## Recommended Options

### Option 1. Vitest + Testing Library

Recommended for React/Vite frontend projects.

### Option 2. Jest + Testing Library

Recommended for Jest-based projects.

### Option 3. Playwright

Recommended for browser-based E2E tests.

### Option 4. Add MSW

Recommended when API mocking is required.

### Option 5. Custom

The user provides the preferred test library or setup.

## Approval Required

Do not install dependencies or change package, lock, config, setup, or test
files until the user approves one option.
