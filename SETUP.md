# Repository Setup Guide

This guide will help you set up the new `pathao-merchant-sdk` repository.

## 🚀 **Quick Setup**

### 1. **Create GitHub Repository**
```bash
# Create a new repository on GitHub named "pathao-merchant-sdk"
# Make it PUBLIC for open source visibility
```

### 2. **Initialize Git Repository**
```bash
cd /Users/sifatjasim/Desktop/pathao-merchant-sdk
git init
git add .
git commit -m "Initial commit: Pathao Merchant API SDK"
```

### 3. **Connect to GitHub**
```bash
git remote add origin https://github.com/sifat07/pathao-merchant-sdk.git
git branch -M main
git push -u origin main
```

### 4. **Install Dependencies & Test**
```bash
pnpm install
pnpm run build
pnpm test
```

### 5. **Publish to npm**
```bash
npm login
npm publish
```

## 📁 **Repository Structure**

```
pathao-merchant-sdk/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main export file
│   ├── pathao-api.ts      # Core API service
│   └── types.ts           # TypeScript definitions
├── tests/                 # Unit tests
├── examples/              # Usage examples
├── dist/                  # Built files (auto-generated)
├── package.json           # Package configuration
├── README.md             # Documentation
├── LICENSE               # MIT license
├── .gitignore           # Git ignore rules
├── .npmignore           # NPM ignore rules
├── tsconfig.json        # TypeScript config
├── tsup.config.ts       # Build configuration
└── jest.config.js       # Test configuration
```

## 🔧 **Package Details**

- **Name**: `@sifat07/pathao-merchant-sdk`
- **Version**: `1.0.0`
- **Description**: Unofficial Pathao Merchant API SDK for Node.js and TypeScript
- **Repository**: `https://github.com/sifat07/pathao-merchant-sdk.git`

## ✅ **Pre-Publish Checklist**

- [x] All tests passing
- [x] Build successful
- [x] Package name updated
- [x] Repository URLs updated
- [x] README updated with new package name
- [x] Examples updated
- [x] .gitignore configured
- [x] .npmignore configured

## 🎯 **Next Steps**

1. Create the GitHub repository
2. Push the code
3. Set up GitHub Actions for CI/CD
4. Publish to npm
5. Create GitHub releases for version tags

## 📝 **GitHub Repository Settings**

- **Repository name**: `pathao-merchant-sdk`
- **Description**: `Unofficial Pathao Merchant API SDK for Node.js and TypeScript`
- **Visibility**: Public
- **Topics**: `pathao`, `merchant`, `api`, `sdk`, `typescript`, `nodejs`, `bangladesh`
- **License**: MIT


