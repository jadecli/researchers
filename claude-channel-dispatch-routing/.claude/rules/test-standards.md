---
paths: ["**/*.test.*", "**/*.spec.*", "**/tests/**", "**/__tests__/**"]
---

# Test Standards Per Language

## Modern Test Packages (2025-2026)

### TypeScript / JavaScript
- **vitest** ^2.0.0 — Primary test runner (Vite-native, ESM-first, 10x faster than Jest)
- **@testing-library/react** — React component tests (if applicable)
- **msw** ^2.0.0 — API mocking via Service Workers
- **zod** — Runtime schema validation in tests

```bash
npm i -D vitest @types/node
```

### Python
- **pytest** >=8.0 — Primary test runner
- **pytest-anyio** — Async test support (replaces pytest-asyncio)
- **pytest-cov** — Coverage reporting
- **hypothesis** — Property-based testing
- **responses** or **respx** — HTTP mocking
- **factory-boy** — Test fixtures

```bash
uv pip install pytest pytest-anyio pytest-cov hypothesis respx
```

### Go
- **testing** (stdlib) — Primary
- **testify** — Assertions + mocking
- **httptest** (stdlib) — HTTP test servers
- **go test -race** — Race condition detection

```bash
go get github.com/stretchr/testify
```

### Rust
- **cargo test** (built-in) — Primary
- **proptest** — Property-based testing
- **mockall** — Mock generation
- **tokio::test** — Async test runtime
- **insta** — Snapshot testing

```bash
cargo add --dev proptest mockall insta
```

### Java
- **JUnit 5** (Jupiter) — Primary
- **AssertJ** — Fluent assertions
- **Mockito** — Mocking
- **WireMock** — HTTP mocking

### Kotlin
- **kotlin.test** — Primary
- **kotlinx-coroutines-test** — Coroutine testing
- **MockK** — Kotlin-native mocking

### C#
- **xUnit** — Primary (replaces NUnit/MSTest)
- **FluentAssertions** — Fluent assertion syntax
- **NSubstitute** — Mocking

### PHP
- **PHPUnit** ^10.0 — Primary
- **Pest** ^2.0 — Modern alternative with expressive syntax

### Ruby
- **minitest** (stdlib) — Primary (lightweight)
- **RSpec** ^3.13 — BDD-style (feature-rich)
- **WebMock** — HTTP mocking
- **VCR** — HTTP recording/replay

### Swift
- **XCTest** (built-in) — Primary
- **swift-testing** — Modern Swift testing (Swift 5.9+)

### Lua
- **busted** — BDD testing framework
- **luaunit** — xUnit-style

### C/C++
- **GTest** (Google Test) — Primary
- **Catch2** ^3.0 — Header-only alternative
- **FakeIt** — Mocking

## Test Writing Principles (Boris Cherny Aligned)

1. **Type-level tests**: Use `expectTypeOf` (vitest) or `// @ts-expect-error` annotations to test that branded types prevent cross-assignment
2. **Exhaustiveness tests**: Verify that every discriminated union variant is handled
3. **Result pattern tests**: Test both Ok and Err paths for every Result-returning function
4. **No mocking the system under test**: Mock external dependencies only
5. **Test file naming**: `{module}.test.ts` colocated with source, or `__tests__/{module}.test.ts`
6. **Arrange-Act-Assert**: Every test has exactly these 3 sections
7. **One assertion per test concept**: Multiple assertions OK if testing the same behavior
