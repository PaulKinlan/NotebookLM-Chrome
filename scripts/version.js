#!/usr/bin/env node

/**
 * Semantic versioning script for FolioLM
 * Updates version in both package.json and manifest.json
 *
 * Usage:
 *   node scripts/version.js patch   # 0.1.0 -> 0.1.1
 *   node scripts/version.js minor   # 0.1.0 -> 0.2.0
 *   node scripts/version.js major   # 0.1.0 -> 1.0.0
 *   node scripts/version.js 1.2.3   # Set specific version
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PACKAGE_JSON = join(rootDir, 'package.json');
const MANIFEST_JSON = join(rootDir, 'manifest.json');

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected x.y.z`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(currentVersion, type) {
  const version = parseVersion(currentVersion);

  switch (type) {
    case 'major':
      version.major += 1;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor += 1;
      version.patch = 0;
      break;
    case 'patch':
      version.patch += 1;
      break;
    default:
      // Assume it's a specific version string
      return type;
  }

  return formatVersion(version);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/version.js <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  const versionArg = args[0];

  // Validate if it's a specific version
  if (!['patch', 'minor', 'major'].includes(versionArg)) {
    try {
      parseVersion(versionArg);
    } catch {
      console.error(`Invalid argument: ${versionArg}`);
      console.error('Expected: patch, minor, major, or a version like x.y.z');
      process.exit(1);
    }
  }

  // Read current files
  const packageJson = readJSON(PACKAGE_JSON);
  const manifestJson = readJSON(MANIFEST_JSON);

  const currentVersion = packageJson.version;
  const newVersion = bumpVersion(currentVersion, versionArg);

  // Validate versions are in sync before updating
  if (packageJson.version !== manifestJson.version) {
    console.warn(`Warning: Versions out of sync!`);
    console.warn(`  package.json:  ${packageJson.version}`);
    console.warn(`  manifest.json: ${manifestJson.version}`);
    console.warn(`Both will be updated to: ${newVersion}`);
  }

  // Update versions
  packageJson.version = newVersion;
  manifestJson.version = newVersion;

  // Write files
  writeJSON(PACKAGE_JSON, packageJson);
  writeJSON(MANIFEST_JSON, manifestJson);

  console.log(`Version updated: ${currentVersion} -> ${newVersion}`);
  console.log(`  Updated: package.json`);
  console.log(`  Updated: manifest.json`);

  // Output the new version for use in other scripts
  process.stdout.write(newVersion);
}

main();
