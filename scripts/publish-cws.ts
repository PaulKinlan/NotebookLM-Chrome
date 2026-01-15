#!/usr/bin/env node

/**
 * Publish extension to Chrome Web Store using the Chrome Web Store API
 * Called by semantic-release during the release process
 *
 * Required environment variables:
 * - CWS_EXTENSION_ID: Chrome Web Store extension ID
 * - CWS_PUBLISHER_ID: Chrome Web Store publisher ID (from Developer Dashboard)
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
  refresh_token: string;
  scope: string;
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

const extensionId = process.env.CWS_EXTENSION_ID!;
const publisherId = process.env.CWS_PUBLISHER_ID!;
const clientId = process.env.CWS_CLIENT_ID!;
const clientSecret = process.env.CWS_CLIENT_SECRET!;
const refreshToken = process.env.CWS_REFRESH_TOKEN!;

if (!extensionId || !publisherId || !clientId || !clientSecret || !refreshToken) {
  console.error("Missing required environment variables:");
  console.error("  - CWS_EXTENSION_ID");
  console.error("  - CWS_PUBLISHER_ID");
  console.error("  - CWS_CLIENT_ID");
  console.error("  - CWS_CLIENT_SECRET");
  console.error("  - CWS_REFRESH_TOKEN");
  process.exit(1);
}

/**
 * Exchange refresh token for access token
 * @see https://developer.chrome.com/docs/webstore/using-api#refresh_your_access_token
 */
async function getAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
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
 * Upload extension package to Chrome Web Store
 * @see https://developer.chrome.com/docs/webstore/using-api#upload_a_package_to_update_an_existing_store_item
 */
async function uploadExtension(accessToken: string, zipPath: string): Promise<void> {
  console.log(`Uploading ${zipPath} to Chrome Web Store...`);

  const zipBuffer = readFileSync(zipPath);
  const response = await fetch(
    `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: zipBuffer,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as UploadResponse;

  if (data.uploadState === "UPLOAD_IN_PROGRESS") {
    // Poll for completion
    console.log("Upload in progress, polling for completion...");
    await pollUploadStatus(accessToken);
  } else if (data.uploadState !== "SUCCESS") {
    throw new Error(`Upload not successful: ${JSON.stringify(data)}`);
  }

  console.log("Upload successful!");
}

/**
 * Poll upload status until completion
 */
async function pollUploadStatus(accessToken: string): Promise<void> {
  const maxAttempts = 30;
  const delay = 2000; // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delay));

    const response = await fetch(
      `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch upload status: ${response.status} ${text}`);
    }

    const data = (await response.json()) as UploadResponse;

    if (data.uploadState === "SUCCESS") {
      console.log("Upload completed after polling!");
      return;
    }

    if (data.uploadState !== "UPLOAD_IN_PROGRESS") {
      throw new Error(`Upload failed during polling: ${JSON.stringify(data)}`);
    }

    console.log(`Still uploading... (${i + 1}/${maxAttempts})`);
  }

  throw new Error("Upload timed out after maximum polling attempts");
}

/**
 * Publish extension to Chrome Web Store
 * @see https://developer.chrome.com/docs/webstore/using-api#publish_an_item
 */
async function publishExtension(accessToken: string): Promise<void> {
  console.log("Publishing extension to Chrome Web Store...");

  const response = await fetch(
    `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Publish failed: ${response.status} ${text}`);
  }

  // v2 API returns empty body on success (HTTP 202)
  if (response.status === 202) {
    console.log("Extension submitted for review successfully!");
    console.log("The extension will be published once it passes review.");
  } else {
    const data = (await response.json()) as PublishResponse;
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
