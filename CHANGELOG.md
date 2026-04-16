# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2](https://github.com/Sifat07/pathao-merchant-sdk/compare/v2.1.1...v2.1.2) (2026-04-16)


### Bug Fixes

* correct version base to 2.2.0 and use PAT for release-please ([bba81da](https://github.com/Sifat07/pathao-merchant-sdk/commit/bba81da81d423d4d40b161c430bdac614e6de2ad))
* upgrade pnpm to v10 in CI to fix audit endpoint 410 error ([6d4e147](https://github.com/Sifat07/pathao-merchant-sdk/commit/6d4e147800e78d4a56a0d4655929b817b226298a))

## [Unreleased]

### Added

- `PATHAO_STORE_ID` env var documented in `.env.example`
- `examples/tsconfig.json` — scoped tsconfig for the examples directory so `process` and Node types resolve correctly in IDE
- Comprehensive test suite rewrite: 67 tests covering all code paths including config validation, factory methods, all static validation helpers, pagination, URL encoding, retry backoff, circuit breaker, and debug token redaction

### Changed

- `.env` renamed to `.env.example` with placeholder credentials (proper convention for committed template files)
- Example files updated: package name corrected from `@sifat07/pathao-merchant-sdk` to `pathao-merchant-sdk`
- `examples/test-sandbox.ts`: fixed import path and updated doc URL to `merchant.pathao.com/courier/developer-api`
- Debug log comment in `advanced-usage.ts` corrected to show `Bearer [REDACTED]` (matches actual SDK behavior)

### Removed

- `IMPROVEMENTS.md` — internal dev notes, not relevant to consumers
- `RELEASE.md` / `RELEASE_NOTES.md` — redundant with `CHANGELOG.md`
- `SETUP.md` — personal repo-setup scratch file
- `env.example` — duplicate of `.env.example`
- `docs/pathao-api-reference.txt` — superseded by `docs/official-pathao-api-documentation.md`
- `examples/env-example.js` — superseded by `.env.example`
- `coverage/` — generated artifact (already gitignored)

---

## [2.2.0] - 2026-04-16

### Added

- 3 new webhook event types from official Pathao dashboard documentation:
  - `order.return-id-created` (`ORDER_RETURN_ID_CREATED`)
  - `order.return-in-transit` (`ORDER_RETURN_IN_TRANSIT`)
  - `order.returned-to-merchant` (`ORDER_RETURNED_TO_MERCHANT`)
- `ReturnOrderWebhookPayload` base interface with `return_consignment_id`, `return_type`, `collected_amount`, `reason?`

### Fixed

- `tsconfig.json`: added `node` and `jest` to `types` array — resolves `Buffer` and `EventEmitter` type errors
- Webhook secret header is now always set on every response (not just handshake)

### Changed

- Webhook documentation updated to reflect official Pathao dashboard specs
- Sandbox credentials restored in `docs/` for developer convenience (publicly provided by Pathao)

---

## [2.1.0] - 2026-03-10

### Added

- `pathao-merchant-sdk/webhooks` sub-path entry point (zero extra runtime dependencies)
- `PathaoWebhookHandler` — EventEmitter with fully typed `on()` and `once()` overloads for all event types
- `constructEvent(rawBody)` — parse and validate a webhook payload
- Express middleware via `handler.expressMiddleware()`
- Framework-agnostic middleware via `handler.middleware()` — never rejects, returns `WebhookResponseInstructions`
- `PathaoWebhookError` error class
- Constant-time secret comparison via `crypto.timingSafeEqual`
- Full TypeScript payload types for all 21 event types with `WebhookEventPayloadMap`

---

## [2.0.2] - 2025-12-08

### Added

- Factory methods: `PathaoApiService.fromEnv()`, `PathaoApiService.fromConfig()`, `PathaoApiService.sandbox()`, `PathaoApiService.production()`
- `debug` option — logs all HTTP requests and responses; `Authorization` header redacted as `Bearer [REDACTED]`
- Configurable circuit breaker via `circuitBreaker: { threshold, timeout }` option

### Changed

- **Breaking**: Configuration validation deferred to first API call — constructor no longer throws
- Constructor now accepts optional second argument: `new PathaoApiService(config, { debug?, circuitBreaker? })`

### Fixed

- `ResolvedPathaoConfig` internal type ensures `timeout` is always a `number`
- Circuit breaker resets correctly on successful requests
- `parseInt` NaN + zero guard for `PATHAO_TIMEOUT` env var
- `encodeURIComponent()` applied to `consignmentId` in URL path
- Removed `as any` / `as Error` casts — replaced with proper type guards
- Removed dead `requestQueue` / `processRequestQueue` code
- Scoped `jest.spyOn` restores only console spies in test setup

---

## [2.0.1] - 2025-12-05

### Added

- `PathaoApiError` class with structured fields: `status`, `code`, `type`, `errors`, `validation`, `responseData`
- All SDK methods now throw `PathaoApiError` instead of plain `Error`

---

## [1.2.0] - 2024-12-05

### Added

- `CONTRIBUTING.md` for contributors
- Reorganized documentation into `docs/` folder
- ESM `exports` field in `package.json` with `sideEffects: false`

### Fixed

- `PathaoPriceRequest` type — removed incorrect `recipient_area` field
- Split store response types into `PathaoStoreCreateResponse` and `PathaoStoreListResponse`
- README examples updated to match official API response structures
- Removed deprecated `StoreType` enum references

---

## [1.1.0] - 2024-10-01

### Added

- CI/CD pipeline and automatic release management via GitHub Actions

---

## [1.0.0] - 2024-10-01

### Added

- Initial release
- Full TypeScript support with complete type definitions
- Automatic OAuth2 authentication and token refresh
- Order management: create single order, bulk orders, track by consignment ID
- Store management: create store, list stores with pagination, `getStoresAll()` auto-paginator
- Price calculation
- Location services: cities, zones, areas
- `PathaoApiError` for structured error handling
- Built-in static validation helpers: phone, address, weight, name
- `User-Agent: pathao-merchant-sdk node/<version>` header
- Retry logic: 429 reads `Retry-After`; 5xx exponential backoff (max 2 retries)
- Circuit breaker: throws `PathaoApiError` (code 503) when open
- HTTPS enforcement in `validateConfiguration()`
- Support for both CommonJS and ESM module formats

<!-- comparison links -->

[Unreleased]: https://github.com/sifat07/pathao-merchant-sdk/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/sifat07/pathao-merchant-sdk/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/sifat07/pathao-merchant-sdk/compare/v2.0.2...v2.1.0
[2.0.2]: https://github.com/sifat07/pathao-merchant-sdk/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/sifat07/pathao-merchant-sdk/compare/v1.2.0...v2.0.1
[1.2.0]: https://github.com/sifat07/pathao-merchant-sdk/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/sifat07/pathao-merchant-sdk/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sifat07/pathao-merchant-sdk/releases/tag/v1.0.0
