## [1.3.0] - 2025-12-04

### ✨ New Features
- b4fa591 feat: enhance Pathao API SDK with environment variable support and improved error handling


# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.2] - 2025-12-08

### Added
- **Factory methods**: `PathaoApiService.fromEnv()` and `PathaoApiService.fromConfig()` for convenient initialization patterns
- **Debug logging**: Optional `debug` flag in constructor options to log all HTTP requests and responses
- **Configurable circuit breaker**: `circuitBreaker` option to customize failure threshold and timeout
- **Comprehensive error handling examples** in README with `PathaoApiError` usage patterns
- **Advanced options documentation** for factory methods and configuration

### Changed
- **Breaking**: Deferred configuration validation to first API call instead of constructor throw. SDK now initializes successfully even without credentials, and throws `PathaoApiError` when attempting an API call with missing config.
- Removed config duplication in constructor (axios create config now uses resolved config values).
- Constructor now accepts optional `options` parameter: `new PathaoApiService(config, { debug?, circuitBreaker? })`
- Constructor no longer throws upfront, allowing graceful error handling at first API usage.

### Fixed
- `ResolvedPathaoConfig` internal type ensures `timeout` is always a number.
- Tests updated to reflect deferred validation behavior.
- Circuit breaker now properly resets on successful requests and maintains configurable thresholds.

### Verified
- `npm test` passes with 22/22 tests.
- Build succeeds (CJS/ESM/DTS).

## [2.0.1] - 2025-12-05

### Changed
- Added `PathaoApiError` with structured fields (`status`, `code`, `type`, `errors`, `validation`, `responseData`) and updated all SDK methods to throw it.

### Verified
- `npm test` (jest) passes.

## [1.2.0] - 2024-12-05

### Fixed
- Fixed `PathaoPriceRequest` type - removed incorrect `recipient_area` field
- Split store response types into `PathaoStoreCreateResponse` and `PathaoStoreListResponse`
- Updated README examples to match official API response structures
- Removed deprecated `StoreType` enum references

### Changed
- Enhanced package.json with ESM exports field and sideEffects flag
- Improved npm package structure with .npmignore
- Added CONTRIBUTING.md for contributors
- Reorganized documentation files into docs/ folder

### Verified
- All endpoints tested against official Pathao sandbox API
- Type definitions verified against actual API responses

## [1.1.0] - 2024-10-01

### Added
- Comprehensive CI/CD pipeline and automatic release management

## [1.0.0] - 2024-10-01

### Added
- Initial release of Pathao Merchant API SDK
- Full TypeScript support with complete type definitions
- Automatic OAuth2 authentication and token refresh
- Order management (create, track, status)
- Store management (create, list stores)
- Price calculation for delivery charges
- Location services (cities, zones, areas)
- Comprehensive error handling
- Built-in validation helpers
- Support for both CommonJS and ESM
- Extensive documentation and examples

### Features
- 🚀 Full TypeScript Support
- 🔐 Automatic Authentication
- 📦 Order Management
- 🏪 Store Management
- 💰 Price Calculation
- 🌍 Location Services
- ⚡ Built with Axios
- 🛡️ Error Handling
- 📚 Well Documented

## [1.0.0] - 2025-01-01

### Added
- Initial release
- Complete Pathao API integration
- TypeScript support
- Automatic authentication
- Order management
- Store management
- Price calculation
- Location services
