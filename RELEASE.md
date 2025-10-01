# Release Management

This project uses automated CI/CD pipelines for testing, building, and publishing releases.

## 🚀 Automatic Releases

### How it works

1. **Push to main branch** triggers automatic release
2. **Release script analyzes commits** since last tag
3. **Version is determined** based on commit messages:
   - `feat:` or `feature:` → Minor version bump
   - `fix:` or `bugfix:` → Patch version bump
   - `BREAKING CHANGE:` → Major version bump
4. **Changelog and release notes** are generated automatically
5. **Package is published** to npm
6. **GitHub release** is created with assets

### Commit Message Convention

Use conventional commit messages for automatic versioning:

```bash
# Patch release (1.0.0 → 1.0.1)
git commit -m "fix: resolve authentication issue"
git commit -m "chore: update dependencies"

# Minor release (1.0.0 → 1.1.0)
git commit -m "feat: add new validation method"
git commit -m "feature: support bulk order creation"

# Major release (1.0.0 → 2.0.0)
git commit -m "feat: redesign API interface

BREAKING CHANGE: The createOrder method now requires additional parameters"
```

## 🛠️ Manual Releases

### Using GitHub Actions

1. Go to **Actions** tab in GitHub
2. Select **Manual Release** workflow
3. Click **Run workflow**
4. Choose release type:
   - **auto**: Analyze commits automatically
   - **patch**: Bump patch version (1.0.0 → 1.0.1)
   - **minor**: Bump minor version (1.0.0 → 1.1.0)
   - **major**: Bump major version (1.0.0 → 2.0.0)

### Using Local Scripts

```bash
# Automatic release (analyzes commits)
npm run release

# Dry run (see what would be released)
npm run release:dry-run

# Generate changelog only
npm run changelog

# Manual version bumping
npm run version:patch    # 1.0.0 → 1.0.1
npm run version:minor    # 1.0.0 → 1.1.0
npm run version:major    # 1.0.0 → 2.0.0
```

## 📋 Release Process

### Automatic Process

1. **Code pushed to main**
2. **CI/CD pipeline runs**:
   - ✅ Linting and type checking
   - ✅ Unit tests
   - ✅ Build process
   - ✅ Security audit
3. **Release script executes**:
   - Analyzes commits since last tag
   - Determines version bump type
   - Updates package.json
   - Generates CHANGELOG.md
   - Creates RELEASE_NOTES.md
   - Creates git tag
4. **Publishing**:
   - Pushes changes to GitHub
   - Publishes to npm registry
   - Creates GitHub release

### Manual Process

1. **Make your changes**
2. **Commit with conventional messages**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin main
   ```
3. **Trigger manual release** via GitHub Actions
4. **Or run locally**:
   ```bash
   npm run release
   git push origin main --tags
   npm publish
   ```

## 🔧 Configuration

### Required Secrets

Set these in your GitHub repository settings:

- `NPM_TOKEN`: Your npm authentication token
- `GITHUB_TOKEN`: Automatically provided by GitHub

### Package.json Scripts

```json
{
  "scripts": {
    "release": "node scripts/release.js",
    "release:dry-run": "node scripts/release.js --dry-run",
    "changelog": "node scripts/release.js --changelog-only",
    "version:patch": "npm version patch --no-git-tag-version",
    "version:minor": "npm version minor --no-git-tag-version",
    "version:major": "npm version major --no-git-tag-version"
  }
}
```

## 📁 Generated Files

### CHANGELOG.md
- Detailed changelog with categorized changes
- Automatically updated on each release
- Follows Keep a Changelog format

### RELEASE_NOTES.md
- User-friendly release notes
- Installation instructions
- Links to documentation
- Generated for each release

## 🚨 Troubleshooting

### Common Issues

1. **Version already exists on npm**
   - The pipeline will skip publishing
   - Check if version was already published

2. **Git tag already exists**
   - Delete the tag: `git tag -d v1.0.0`
   - Push deletion: `git push origin :refs/tags/v1.0.0`

3. **Release script fails**
   - Check commit message format
   - Ensure you're on main branch
   - Verify git history is available

### Debug Commands

```bash
# Check current version
npm version

# See what would be released
npm run release:dry-run

# Check git tags
git tag --sort=-version:refname

# Check commits since last tag
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

## 📚 Best Practices

1. **Use conventional commits** for automatic versioning
2. **Test locally** before pushing to main
3. **Review generated changelog** before release
4. **Keep commits atomic** and focused
5. **Use descriptive commit messages**
6. **Test the release process** in a separate branch first

## 🔗 Links

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
