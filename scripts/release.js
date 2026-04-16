#!/usr/bin/env node

/**
 * Release script for pathao-merchant-sdk
 *
 * - Bumps version in package.json based on commit messages since last tag
 * - Promotes [Unreleased] in CHANGELOG.md to the new version + date
 * - Creates a git tag
 *
 * Flags:
 *   --dry-run         Print what would happen without modifying any files
 *   --changelog-only  Update CHANGELOG.md only, skip version bump and git tag
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.error) throw result.error;
  return result.stdout.trim();
}

function getLastTag() {
  const tags = git("tag", "--sort=-version:refname")
    .split("\n")
    .filter((t) => /^v\d/.test(t));
  return tags[0] || null;
}

function getCommitsSinceLastTag() {
  const lastTag = getLastTag();
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const out = git("log", "--oneline", range);
  return out ? out.split("\n").filter(Boolean) : [];
}

function determineVersionBump(commits) {
  for (const c of commits) {
    const msg = c.toLowerCase();
    if (
      msg.includes("breaking change:") ||
      msg.includes("breaking:") ||
      msg.includes("major:")
    ) {
      return "major";
    }
  }
  for (const c of commits) {
    const msg = c.toLowerCase();
    if (
      msg.includes("feat:") ||
      msg.includes("feature:") ||
      msg.includes("minor:") ||
      msg.includes("new:")
    ) {
      return "minor";
    }
  }
  return "patch";
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function promoteUnreleased(changelogContent, newVersion, date) {
  return changelogContent.replace(
    /^## \[Unreleased\]/m,
    `## [Unreleased]\n\n---\n\n## [${newVersion}] - ${date}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run({ dryRun = false, changelogOnly = false } = {}) {
  console.log("Starting release process...\n");
  if (dryRun) console.log("DRY RUN — no files will be modified.\n");

  const pkg = readJson(PACKAGE_JSON_PATH);
  const currentVersion = pkg.version;

  const commits = getCommitsSinceLastTag();
  console.log(`Commits since last tag: ${commits.length}`);
  if (commits.length === 0) {
    console.log("No new commits. Nothing to release.");
    return;
  }

  const bumpType = determineVersionBump(commits);
  const newVersion = bumpVersion(currentVersion, bumpType);
  const date = new Date().toISOString().split("T")[0];

  console.log(`Bump type : ${bumpType}`);
  console.log(`Version   : ${currentVersion} → ${newVersion}`);
  console.log(`Date      : ${date}`);

  if (dryRun) {
    console.log("\nDry run complete. No files changed.");
    return { version: newVersion, type: bumpType };
  }

  // Update CHANGELOG.md — promote [Unreleased] to new version
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");
  fs.writeFileSync(
    CHANGELOG_PATH,
    promoteUnreleased(changelog, newVersion, date),
  );
  console.log("Updated CHANGELOG.md");

  if (!changelogOnly) {
    // Bump package.json
    pkg.version = newVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n");
    console.log("Updated package.json");

    // Create git tag
    spawnSync(
      "git",
      ["tag", "-a", `v${newVersion}`, "-m", `Release v${newVersion}`],
      {
        cwd: ROOT,
        stdio: "inherit",
      },
    );
    console.log(`Created git tag v${newVersion}`);
  }

  console.log("\nRelease complete.");
  return { version: newVersion, type: bumpType };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  try {
    run({
      dryRun: args.includes("--dry-run"),
      changelogOnly: args.includes("--changelog-only"),
    });
  } catch (err) {
    console.error("Release failed:", err.message);
    process.exit(1);
  }
}

module.exports = { run };
