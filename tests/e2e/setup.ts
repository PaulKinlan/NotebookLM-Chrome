/**
 * E2E Test Setup Utilities
 *
 * Helper functions for launching Chrome with the FolioLM extension loaded
 * and accessing extension pages for testing.
 */

import * as path from 'path';
import * as fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';

// Re-export types for test imports
export type { Browser, Page };

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
 *
 * Environment variables:
 * - HEADED: Set to "true" to run in headed mode (shows browser window). Defaults to headless.
 * - CI: Automatically detected for CI environments
 * - SLOW_MO: Slow down actions by specified milliseconds for visibility
 * - CHROME_PATH: Path to Chrome executable (defaults to system Chrome)
 */
export async function launchWithExtension(): Promise<Browser> {
  const isCI = process.env.CI === 'true';
  // HEADED=true forces headed mode, otherwise default to headless
  const isHeaded = process.env.HEADED === 'true';

  // Clean up profile before launching to ensure fresh state
  await cleanupProfile();

  const browser = await puppeteer.launch({
    // Use "new" headless mode for better compatibility with extensions
    // Fall back to false if HEADED is explicitly set
    headless: (isHeaded ? false : 'new') as boolean,
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
      // Enable Chrome Built-in AI (Gemini Nano) for testing
      '--enable-features=OptimizationGuideOnDeviceModel:BypassPerfRequirement',
      '--enable-features=PromptApiForGeminiNano:enable',
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
    // Debug: Check if the button exists before clicking
    const buttonCheck = await page.evaluate(() => {
      const btn = document.getElementById('new-notebook-btn');
      const header = document.querySelector('header');
      const app = document.getElementById('app');
      return {
        buttonExists: !!btn,
        buttonHasOnClick: btn ? ('onclick' in btn) : false,
        headerExists: !!header,
        headerHtml: header ? header.innerHTML.slice(0, 500) : 'No header',
        appChildCount: app ? app.childElementCount : 0,
        appChildren: app ? Array.from(app.children).map(c => c.tagName) : [],
        allButtonsWithIds: Array.from(document.querySelectorAll('button[id]')).map(b => b.id),
      };
    });
    console.log('[ensureNotebookExists] Button check:', buttonCheck);

    // Create a notebook by clicking the new notebook button
    await page.click('#new-notebook-btn');

    // Wait a bit for the click handler to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Wait for the dialog to appear in DOM
    await page.waitForSelector('#notebook-name-input', { timeout: 3000 });

    // Wait for the component to fully render and attach event listeners
    // The dialog uses showModal() and our JSX runtime schedules updates via RAF
    await new Promise(resolve => setTimeout(resolve, 300));

    // Use a more robust method to type into the input:
    // 1. Focus the input first
    // 2. Use page.type() which simulates real keyboard events (keydown, input, keyup)
    // 3. This ensures the onInput handler is called with the correct value
    await page.focus('#notebook-name-input');
    await page.type('#notebook-name-input', 'Test Notebook', { delay: 50 });

    // Wait for the state to update (onInput handler updates inputValueRef)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify the input value was set correctly
    const inputValue = await page.evaluate(() => {
      const input = document.getElementById('notebook-name-input') as HTMLInputElement;
      return input?.value || '';
    });
    console.log('[ensureNotebookExists] Input value after typing:', inputValue);

    // If typing didn't work (value is empty), fall back to manual dispatch
    if (inputValue === '') {
      console.log('[ensureNotebookExists] Typing did not set value, using fallback method');
      await page.evaluate(() => {
        const input = document.getElementById('notebook-name-input') as HTMLInputElement;
        if (input) {
          // Set the value directly
          input.value = 'Test Notebook';
          // Use InputEvent instead of generic Event for better compatibility
          const event = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: 'Test Notebook',
            inputType: 'insertText',
          });
          input.dispatchEvent(event);
        }
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Click confirm button using page.evaluate to bypass modal backdrop blocking
    // When dialog is shown with showModal(), the top layer rendering can interfere with Puppeteer
    await page.evaluate(() => {
      const btn = document.getElementById('notebook-dialog-confirm') as HTMLButtonElement;
      if (btn) btn.click();
    });

    // Wait for notebook to be created and selected
    // First, wait a bit for any pending RAF callbacks to execute
    await new Promise(resolve => setTimeout(resolve, 500));

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

  // Capture console for debugging - capture all logs
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    // Log to test output for visibility - include all relevant debug messages
    if (msg.type() === 'error' || msg.type() === 'warn' ||
        text.includes('[') ||
        text.includes('[mountElement]') || text.includes('[applyProps]') ||
        text.includes('[NotebookDialog]') || text.includes('[App') ||
        text.includes('[updateComponent') || text.includes('[useState') ||
        text.includes('[renderComponent') || text.includes('[render]') ||
        text.includes('[mountComponent]') || text.includes('[useDialog') ||
        text.includes('[ensureNotebookExists')) {
      console.log(`Browser Console [${msg.type()}]:`, text);
    }
  });
  page.on('pageerror', (err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    consoleMessages.push(`Page error: ${errMsg}`);
    console.error('Browser Page Error:', errMsg);
  });

  // Navigate to the page
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
  await page.waitForSelector('body', { timeout: 5000 });

  // Wait for onboarding to appear (it might not appear if already complete)
  await new Promise(resolve => setTimeout(resolve, 500));

  // Dismiss onboarding overlay if it's present
  await dismissOnboarding(page);

  // Wait for initialization to complete by checking for an element
  // that's rendered after init() finishes (e.g., the add tab content)
  try {
    await page.waitForSelector('#tab-add', { timeout: 5000 });
  } catch (e) {
    // Capture page state for debugging
    const html = await page.content();
    const appContent = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app ? app.innerHTML : 'No #app element';
    });
    console.error('=== E2E Debug Info ===');
    console.error('Console messages:', consoleMessages);
    console.error('App content:', appContent.slice(0, 500));
    console.error('Full HTML length:', html.length);
    throw e;
  }

  // Wait for the App component to fully render and attach event listeners
  // The custom JSX runtime renders asynchronously, so we need to wait
  await new Promise(resolve => setTimeout(resolve, 1000));

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
