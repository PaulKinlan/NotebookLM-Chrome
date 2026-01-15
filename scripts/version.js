#!/usr/bin/env node

/**
 * Update manifest.json version from package.json
 * Used by semantic-release to keep manifest.json in sync with package.json version
 *
 * This script is called by semantic-release's @semantic-release/git plugin
 * to ensure the Chrome extension's manifest.json stays in sync with the
 * package version determined by semantic-release.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PACKAGE_JSON = join(rootDir, 'package.json');
const MANIFEST_JSON = join(rootDir, 'manifest.json');

// Read package.json to get the version (set by semantic-release)
const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
const newVersion = pkg.version;

// Read and update manifest.json
const manifest = JSON.parse(readFileSync(MANIFEST_JSON, 'utf-8'));
const oldVersion = manifest.version;
manifest.version = newVersion;

writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Updated manifest.json: ${oldVersion} -> ${newVersion}`);
