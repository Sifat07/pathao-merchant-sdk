## [1.3.0] - 2025-12-04

### ✨ New Features
- b4fa591 feat: enhance Pathao API SDK with environment variable support and improved error handling


# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
