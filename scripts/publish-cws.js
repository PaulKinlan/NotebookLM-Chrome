#!/usr/bin/env node

/**
 * Publish extension to Chrome Web Store
 * Called by semantic-release during the release process
 *
 * Required environment variables:
 * - CWS_EXTENSION_ID: Chrome Web Store extension ID
 * - CWS_CLIENT_ID: Chrome Web Store API client ID
 * - CWS_CLIENT_SECRET: Chrome Web Store API client secret
 * - CWS_REFRESH_TOKEN: Chrome Web Store API refresh token
 *
 * See https://github.com/fregante/chrome-extension-deploy for setup instructions
 */

import cwsDeploy from "chrome-extension-deploy";
const { deploy } = cwsDeploy;

const extensionId = process.env.CWS_EXTENSION_ID;
const clientId = process.env.CWS_CLIENT_ID;
const clientSecret = process.env.CWS_CLIENT_SECRET;
const refreshToken = process.env.CWS_REFRESH_TOKEN;
const zipPath = process.env.ZIP_PATH || "foliolm-extension-*.zip";

if (!extensionId || !clientId || !clientSecret || !refreshToken) {
  console.error("Missing required environment variables:");
  console.error("  - CWS_EXTENSION_ID");
  console.error("  - CWS_CLIENT_ID");
  console.error("  - CWS_CLIENT_SECRET");
  console.error("  - CWS_REFRESH_TOKEN");
  process.exit(1);
}

console.log("Publishing to Chrome Web Store...");

try {
  await deploy({
    extensionId,
    clientId,
    clientSecret,
    refreshToken,
    zip: zipPath,
  });
  console.log("Successfully published to Chrome Web Store!");
} catch (/** @type {unknown} */ error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to publish to Chrome Web Store:", message);
  process.exit(1);
}
