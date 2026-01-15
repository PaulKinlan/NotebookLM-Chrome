#!/usr/bin/env node

/**
 * Publish extension to Chrome Web Store using the Chrome Web Store API
 * Called by semantic-release during the release process
 *
 * Required environment variables:
 * - CWS_EXTENSION_ID: Chrome Web Store extension ID
 * - CWS_CLIENT_ID: Chrome Web Store API client ID
 * - CWS_CLIENT_SECRET: Chrome Web Store API client secret
 * - CWS_REFRESH_TOKEN: Chrome Web Store API refresh token
 *
 * Based on: https://developer.chrome.com/docs/webstore/using-api
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface UploadResponse {
  uploadState: string;
  itemVersion?: string;
}

interface PublishResponse {
  status: string[];
  statusDetail?: string[];
}

const extensionId = process.env.CWS_EXTENSION_ID;
const clientId = process.env.CWS_CLIENT_ID;
const clientSecret = process.env.CWS_CLIENT_SECRET;
const refreshToken = process.env.CWS_REFRESH_TOKEN;

if (!extensionId || !clientId || !clientSecret || !refreshToken) {
  console.error("Missing required environment variables:");
  console.error("  - CWS_EXTENSION_ID");
  console.error("  - CWS_CLIENT_ID");
  console.error("  - CWS_CLIENT_SECRET");
  console.error("  - CWS_REFRESH_TOKEN");
  process.exit(1);
}

/**
 * Exchange refresh token for access token
 */
async function getAccessToken(): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v4/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${text}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Upload extension to Chrome Web Store
 */
async function uploadExtension(accessToken: string, zipPath: string): Promise<void> {
  console.log(`Uploading ${zipPath} to Chrome Web Store...`);

  const zipBuffer = readFileSync(zipPath);
  const response = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${extensionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2",
      },
      body: zipBuffer,
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  const data = JSON.parse(text) as UploadResponse;

  if (data.uploadState !== "SUCCESS") {
    throw new Error(`Upload not successful: ${JSON.stringify(data)}`);
  }

  console.log("Upload successful!");
}

/**
 * Publish extension to Chrome Web Store
 */
async function publishExtension(accessToken: string): Promise<void> {
  console.log("Publishing extension to Chrome Web Store...");

  const response = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-goog-api-version": "2",
      },
      body: JSON.stringify({
        target: "default",
      }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Publish failed: ${response.status} ${text}`);
  }

  const data = JSON.parse(text) as PublishResponse;

  if (data.status && data.status.includes("OK")) {
    console.log("Extension published successfully!");
    console.log(`Status: ${data.status[0]}`);
  } else {
    console.log("Publish response:", data);
  }
}

/**
 * Find the ZIP file in the project root
 */
function findZipFile(): string {
  const files = readdirSync(rootDir);
  const zipFile = files.find((f) => f.startsWith("foliolm-extension-") && f.endsWith(".zip"));

  if (!zipFile) {
    throw new Error("No foliolm-extension-*.zip file found in project root");
  }

  return join(rootDir, zipFile);
}

async function main(): Promise<void> {
  try {
    const zipPath = findZipFile();
    console.log(`Found ZIP file: ${zipPath}`);

    const accessToken = await getAccessToken();
    await uploadExtension(accessToken, zipPath);
    await publishExtension(accessToken);

    console.log("Chrome Web Store publishing complete!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to publish to Chrome Web Store:", message);
    process.exit(1);
  }
}

main();
