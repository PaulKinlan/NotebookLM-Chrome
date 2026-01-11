/**
 * E2E Test Setup Utilities
 *
 * Helper functions for launching Chrome with the FolioLM extension loaded
 * and accessing extension pages for testing.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const PROFILE_DIR = path.join(process.cwd(), 'tests', '.chrome-profile');

/**
 * Clean up the Chrome profile directory to ensure fresh state
 */
export async function cleanupProfile(): Promise<void> {
  if (fs.existsSync(PROFILE_DIR)) {
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

/**
 * Launch Chrome with the FolioLM extension loaded
 */
export async function launchWithExtension(): Promise<Browser> {
  const isCI = process.env.CI === 'true';

  // Clean up profile before launching to ensure fresh state
  await cleanupProfile();

  const browser = await puppeteer.launch({
    headless: false, // Extensions don't work in headless mode
    userDataDir: PROFILE_DIR,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Disable GPU rendering for CI environments
      isCI ? '--disable-gpu' : '',
      // Allow extension to load properly
      '--disable-extensions-file-access-check',
      '--disable-web-security', // Only for testing
    ].filter(Boolean) as string[],
    // Slow down actions for visibility during development
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
  });

  // Wait for extension to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  return browser;
}

/**
 * Get the extension ID from the extension directory
 */
export function getExtensionId(): string {
  // The extension ID is derived from the extension key
  // For development, Chrome uses a random ID each time
  // We'll need to extract it from the browser targets
  throw new Error(
    'Extension ID must be extracted from browser targets. Use getExtensionIdFromBrowser() instead.'
  );
}

/**
 * Extract extension ID from browser targets
 */
export async function getExtensionIdFromBrowser(browser: Browser): Promise<string> {
  const targets = await browser.targets();

  // Find the extension background page or service worker
  const extensionTarget = targets.find(
    (target) =>
      target.type() === 'background_page' ||
      target.type() === 'service_worker' ||
      target.url().startsWith('chrome-extension://')
  );

  if (!extensionTarget) {
    throw new Error('Extension not found. Did it fail to load?');
  }

  const url = extensionTarget.url();
  const match = url.match(/chrome-extension:\/\/([^\/]+)/);

  if (!match) {
    throw new Error(`Could not extract extension ID from URL: ${url}`);
  }

  return match[1];
}

/**
 * Get the extension's background page/service worker page
 */
export async function getExtensionPage(browser: Browser): Promise<Page> {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (target) =>
      target.type() === 'background_page' ||
      target.type() === 'service_worker'
  );

  if (!extensionTarget) {
    throw new Error('Extension background page/service worker not found');
  }

  return browser.newPage();
}

/**
 * Dismiss the onboarding overlay by setting storage and hiding the overlay
 */
async function dismissOnboarding(
  page: Awaited<ReturnType<Browser['newPage']>>
): Promise<void> {
  // First, set the onboarding complete flag in storage
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          onboardingComplete: {
            complete: true,
            version: 1,
            completedAt: Date.now(),
          },
        },
        () => resolve()
      );
    });
  });

  // Then directly hide the onboarding overlay and remove it from DOM
  await page.evaluate(() => {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  });
}

/**
 * Ensure a notebook exists for testing
 * Creates a default notebook if none exists
 */
async function ensureNotebookExists(
  page: Awaited<ReturnType<Browser['newPage']>>
): Promise<void> {
  const hasNotebook = await page.evaluate(() => {
    const select = document.getElementById('notebook-select') as HTMLSelectElement;
    return select && select.options.length > 1; // More than just the placeholder
  });

  if (!hasNotebook) {
    // Create a notebook by clicking the new notebook button
    await page.click('#new-notebook-btn');

    // Wait for the dialog to appear
    await page.waitForSelector('#notebook-name-input', { timeout: 3000 });

    // Enter a notebook name
    await page.type('#notebook-name-input', 'Test Notebook');

    // Click confirm
    await page.click('#notebook-dialog-confirm');

    // Wait for notebook to be created and selected
    // We check this by waiting for the select element to have a value
    await page.waitForFunction(() => {
      const select = document.getElementById('notebook-select') as HTMLSelectElement;
      return select && select.value !== '';
    }, { timeout: 5000 });
  }
}

/**
 * Get the extension's sidepanel page
 */
export async function getSidepanelPage(browser: Browser): Promise<Page> {
  const extensionId = await getExtensionIdFromBrowser(browser);
  const page = await browser.newPage();

  // Navigate to the page
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
  await page.waitForSelector('body', { timeout: 5000 });

  // Wait for onboarding to appear (it might not appear if already complete)
  await new Promise(resolve => setTimeout(resolve, 500));

  // Dismiss onboarding overlay if it's present
  await dismissOnboarding(page);

  // Wait for initialization to complete by checking for an element
  // that's rendered after init() finishes (e.g., the add tab content)
  await page.waitForSelector('#tab-add', { timeout: 5000 });

  // Ensure a notebook exists for testing
  await ensureNotebookExists(page);

  return page;
}

/**
 * Navigate to a specific tab in the sidepanel
 */
export async function navigateToSidepanelTab(
  page: Awaited<ReturnType<Browser['newPage']>>,
  tabName: string
): Promise<void> {
  await page.click(`[data-tab="${tabName}"]`);

  // Wait for navigation to complete
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Clean up browser and close all pages
 */
export async function cleanupBrowser(browser: Browser): Promise<void> {
  const pages = await browser.pages();
  await Promise.all(pages.map((page) => page.close()));
  await browser.close();

  // Clean up Chrome profile for fresh state on next run
  await cleanupProfile();
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Awaited<ReturnType<Browser['newPage']>>,
  selector: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout });
}

/**
 * Get element text content
 */
export async function getElementText(
  page: Awaited<ReturnType<Browser['newPage']>>,
  selector: string
): Promise<string> {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return await page.evaluate((el) => el.textContent || '', element);
}

/**
 * Check if checkbox is checked
 */
export async function isCheckboxChecked(
  page: Awaited<ReturnType<Browser['newPage']>>,
  selector: string
): Promise<boolean> {
  return await page.$eval(
    selector,
    (el) => (el as HTMLInputElement).checked
  );
}

/**
 * Take screenshot on failure
 */
export async function takeScreenshot(
  page: Awaited<ReturnType<Browser['newPage']>>,
  filename: string
): Promise<void> {
  const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  await page.screenshot({
    path: path.join(screenshotsDir, filename),
    fullPage: true,
  });
}
