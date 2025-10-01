#!/usr/bin/env node

/**
 * Automatic Release Script for Pathao Merchant SDK
 * 
 * This script handles:
 * - Semantic versioning based on commit messages
 * - Automatic changelog generation
 * - Release notes creation
 * - Version bumping
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const RELEASE_NOTES_PATH = path.join(__dirname, '..', 'RELEASE_NOTES.md');

// Version types and their commit message patterns
const VERSION_TYPES = {
  major: {
    patterns: ['BREAKING CHANGE:', 'BREAKING:', 'major:'],
    increment: 'major'
  },
  minor: {
    patterns: ['feat:', 'feature:', 'minor:', 'new:'],
    increment: 'minor'
  },
  patch: {
    patterns: ['fix:', 'bugfix:', 'patch:', 'chore:', 'docs:', 'style:', 'refactor:', 'perf:', 'test:'],
    increment: 'patch'
  }
};

class ReleaseManager {
  constructor() {
    this.packageJson = this.loadPackageJson();
    this.currentVersion = this.packageJson.version;
  }

  loadPackageJson() {
    try {
      return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    } catch (error) {
      console.error('Error loading package.json:', error.message);
      process.exit(1);
    }
  }

  getCommitsSinceLastTag() {
    try {
      const lastTag = this.getLastTag();
      const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      const commits = execSync(`git log --oneline ${range}`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(line => line.trim());
      return commits;
    } catch (error) {
      console.error('Error getting commits:', error.message);
      return [];
    }
  }

  getLastTag() {
    try {
      const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(tag => tag.startsWith('v'));
      return tags[0] || null;
    } catch (error) {
      return null;
    }
  }

  determineVersionType(commits) {
    let versionType = 'patch'; // Default to patch

    for (const commit of commits) {
      const message = commit.toLowerCase();
      
      // Check for breaking changes
      if (VERSION_TYPES.major.patterns.some(pattern => message.includes(pattern.toLowerCase()))) {
        versionType = 'major';
        break;
      }
      
      // Check for features
      if (VERSION_TYPES.minor.patterns.some(pattern => message.includes(pattern.toLowerCase()))) {
        versionType = 'minor';
      }
    }

    return versionType;
  }

  bumpVersion(versionType) {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);
    
    let newVersion;
    switch (versionType) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      default:
        throw new Error(`Invalid version type: ${versionType}`);
    }

    return newVersion;
  }

  categorizeCommits(commits) {
    const categories = {
      features: [],
      fixes: [],
      breaking: [],
      chores: [],
      docs: [],
      other: []
    };

    commits.forEach(commit => {
      const message = commit.toLowerCase();
      
      if (message.includes('breaking change:') || message.includes('breaking:')) {
        categories.breaking.push(commit);
      } else if (message.includes('feat:') || message.includes('feature:') || message.includes('new:')) {
        categories.features.push(commit);
      } else if (message.includes('fix:') || message.includes('bugfix:')) {
        categories.fixes.push(commit);
      } else if (message.includes('chore:') || message.includes('refactor:') || message.includes('perf:')) {
        categories.chores.push(commit);
      } else if (message.includes('docs:') || message.includes('readme:')) {
        categories.docs.push(commit);
      } else {
        categories.other.push(commit);
      }
    });

    return categories;
  }

  generateChangelog(newVersion, commits, versionType) {
    const categories = this.categorizeCommits(commits);
    const date = new Date().toISOString().split('T')[0];
    
    let changelog = `## [${newVersion}] - ${date}\n\n`;
    
    if (categories.breaking.length > 0) {
      changelog += '### 🚨 Breaking Changes\n';
      categories.breaking.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }
    
    if (categories.features.length > 0) {
      changelog += '### ✨ New Features\n';
      categories.features.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }
    
    if (categories.fixes.length > 0) {
      changelog += '### 🐛 Bug Fixes\n';
      categories.fixes.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }
    
    if (categories.chores.length > 0) {
      changelog += '### 🔧 Chores & Improvements\n';
      categories.chores.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }
    
    if (categories.docs.length > 0) {
      changelog += '### 📚 Documentation\n';
      categories.docs.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }
    
    if (categories.other.length > 0) {
      changelog += '### 📝 Other Changes\n';
      categories.other.forEach(commit => {
        changelog += `- ${commit}\n`;
      });
      changelog += '\n';
    }

    return changelog;
  }

  generateReleaseNotes(newVersion, versionType) {
    const releaseNotes = `# Pathao Merchant SDK v${newVersion}

## 🚀 Release Information

- **Version**: ${newVersion}
- **Release Type**: ${versionType.charAt(0).toUpperCase() + versionType.slice(1)}
- **Date**: ${new Date().toISOString().split('T')[0]}
- **Package**: [pathao-merchant-sdk](https://www.npmjs.com/package/pathao-merchant-sdk)

## 📦 Installation

\`\`\`bash
npm install pathao-merchant-sdk@${newVersion}
# or
yarn add pathao-merchant-sdk@${newVersion}
# or
pnpm add pathao-merchant-sdk@${newVersion}
\`\`\`

## 🔗 Links

- [GitHub Repository](https://github.com/Sifat07/pathao-merchant-sdk)
- [NPM Package](https://www.npmjs.com/package/pathao-merchant-sdk)
- [Documentation](https://github.com/Sifat07/pathao-merchant-sdk#readme)

## 📋 What's Changed

See the [CHANGELOG.md](./CHANGELOG.md) for detailed changes.

---

*This release was automatically generated by the CI/CD pipeline.*
`;

    return releaseNotes;
  }

  updatePackageJson(newVersion) {
    this.packageJson.version = newVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(this.packageJson, null, 2) + '\n');
    console.log(`✅ Updated package.json to version ${newVersion}`);
  }

  updateChangelog(changelog) {
    let existingChangelog = '';
    if (fs.existsSync(CHANGELOG_PATH)) {
      existingChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    }
    
    const newChangelog = changelog + '\n' + existingChangelog;
    fs.writeFileSync(CHANGELOG_PATH, newChangelog);
    console.log('✅ Updated CHANGELOG.md');
  }

  writeReleaseNotes(releaseNotes) {
    fs.writeFileSync(RELEASE_NOTES_PATH, releaseNotes);
    console.log('✅ Generated RELEASE_NOTES.md');
  }

  createGitTag(newVersion) {
    try {
      execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
      console.log(`✅ Created git tag v${newVersion}`);
    } catch (error) {
      console.error('Error creating git tag:', error.message);
    }
  }

  async run() {
    console.log('🚀 Starting automatic release process...\n');
    
    // Get commits since last tag
    const commits = this.getCommitsSinceLastTag();
    console.log(`📝 Found ${commits.length} commits since last release`);
    
    if (commits.length === 0) {
      console.log('ℹ️  No new commits found. Nothing to release.');
      return;
    }
    
    // Determine version type
    const versionType = this.determineVersionType(commits);
    console.log(`📊 Version type determined: ${versionType}`);
    
    // Calculate new version
    const newVersion = this.bumpVersion(versionType);
    console.log(`🔢 New version: ${this.currentVersion} → ${newVersion}`);
    
    // Generate changelog and release notes
    const changelog = this.generateChangelog(newVersion, commits, versionType);
    const releaseNotes = this.generateReleaseNotes(newVersion, versionType);
    
    // Update files
    this.updatePackageJson(newVersion);
    this.updateChangelog(changelog);
    this.writeReleaseNotes(releaseNotes);
    
    // Create git tag
    this.createGitTag(newVersion);
    
    console.log('\n🎉 Release process completed!');
    console.log(`📦 New version: ${newVersion}`);
    console.log(`🏷️  Git tag: v${newVersion}`);
    console.log(`📄 Changelog: CHANGELOG.md`);
    console.log(`📋 Release notes: RELEASE_NOTES.md`);
    
    return {
      version: newVersion,
      type: versionType,
      commits: commits.length,
      changelog,
      releaseNotes
    };
  }
}

// Run the release manager
if (require.main === module) {
  const releaseManager = new ReleaseManager();
  releaseManager.run().catch(error => {
    console.error('❌ Release process failed:', error.message);
    process.exit(1);
  });
}

module.exports = ReleaseManager;
