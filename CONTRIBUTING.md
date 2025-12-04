# Contributing to Pathao Merchant SDK

Thank you for your interest in contributing to the Pathao Merchant SDK! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pathao-merchant-sdk.git
   cd pathao-merchant-sdk
   ```
3. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Run Tests

```bash
npm test
npm run build
npm run type-check
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
# For new features
git commit -m "feat: add support for webhook notifications"

# For bug fixes
git commit -m "fix: resolve token refresh issue"

# For documentation
git commit -m "docs: update API examples"

# For refactoring
git commit -m "refactor: improve error handling"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting (we use ESLint)
- Write meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing

- Write unit tests for all new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- Test against the sandbox API when possible

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments to new functions/methods
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format
- Include examples for new features

## Pull Request Guidelines

### Before Submitting

- [ ] All tests pass
- [ ] Code builds without errors
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] No console.log or debugging code
- [ ] Code is formatted properly

### PR Description Should Include

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does it work?
4. **Testing** - How was it tested?

### Example PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Tested against sandbox API
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style
- [ ] Documentation updated
- [ ] Tests pass
- [ ] CHANGELOG.md updated
```

## Reporting Bugs

### Before Creating an Issue

1. **Check existing issues** - Maybe it's already reported
2. **Test with latest version** - Update to the latest release
3. **Check documentation** - Ensure you're using the API correctly

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Initialize SDK with...
2. Call method...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- SDK Version: 1.2.0
- Node Version: 18.0.0
- OS: macOS/Windows/Linux
```

## Feature Requests

We welcome feature requests! Please include:

1. **Use Case** - Why do you need this feature?
2. **Proposed Solution** - How do you envision it working?
3. **Alternatives** - What alternatives have you considered?

## Questions?

- Open a [GitHub Discussion](https://github.com/sifat07/pathao-merchant-sdk/discussions)
- Check existing [Issues](https://github.com/sifat07/pathao-merchant-sdk/issues)
- Email: sifatjasim@gmail.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Be respectful and constructive in all interactions. We're here to build something useful together! 🚀
