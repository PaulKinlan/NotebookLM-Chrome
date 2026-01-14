#!/usr/bin/env tsx
/**
 * Screenshot Capture Script
 *
 * Captures screenshots of each view in the FolioLM extension.
 * Run with: tsx scripts/capture-screenshots.ts
 *
 * Environment variables:
 * - HEADED=true: Show browser window while capturing (default: hidden)
 */

import * as path from 'path';
import * as fs from 'fs';
import puppeteer from 'puppeteer';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const SCREENSHOT_DIR = path.join(process.cwd(), 'tests', 'screenshots', 'views');

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface ScreenshotConfig {
  name: string;
  filename: string;
  action: (page: import('puppeteer').Page) => Promise<void>;
}

async function main() {
  console.log('Launching Chrome with FolioLM extension...');

  const browser = await puppeteer.launch({
    headless: process.env.HEADED === 'true' ? false : true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions-file-access-check',
    ],
  });

  // Wait for extension to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get extension ID
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    t => t.type() === 'service_worker' || t.url().startsWith('chrome-extension://')
  );

  if (!extensionTarget) {
    throw new Error('Extension not found. Did it fail to load?');
  }

  const url = extensionTarget.url();
  const match = url.match(/chrome-extension:\/\/([^\/]+)/);
  if (!match) {
    throw new Error('Could not extract extension ID');
  }
  const extensionId = match[1];

  console.log(`Extension ID: ${extensionId}\n`);

  // Helper to get a fresh page
  async function getFreshPage(): Promise<import('puppeteer').Page> {
    const page = await browser.newPage();

    // Navigate to the page first so chrome.storage is available
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await page.waitForSelector('body', { timeout: 10000 });

    // Set dark theme directly via data-theme attribute
    // Note: The app reads uiSettings from IndexedDB, not chrome.storage.local
    // So we set the theme directly on the document element
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Wait for theme to apply and CSS to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    const hasNotebook = await page.evaluate(() => {
      const select = document.getElementById('notebook-select') as HTMLSelectElement;
      return select && select.options.length > 1;
    });

    if (!hasNotebook) {
      await page.click('#new-notebook-btn');
      await new Promise(resolve => setTimeout(resolve, 300));
      await page.type('#notebook-name-input', 'Test Notebook');
      await new Promise(resolve => setTimeout(resolve, 200));
      await page.evaluate(() => {
        const btn = document.getElementById('notebook-dialog-confirm') as HTMLButtonElement;
        if (btn) btn.click();
      });
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Dismiss onboarding modal if present
    try {
      const onboardingVisible = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && !overlay.classList.contains('hidden');
      });
      if (onboardingVisible) {
        await page.click('#onboarding-skip');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch {
      // Onboarding not present or already dismissed
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return page;
  }

  // Helper to capture screenshot
  async function capture(page: import('puppeteer').Page, filename: string): Promise<void> {
    const filepath = path.join(SCREENSHOT_DIR, `${filename}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`  ✓ ${filename}.png`);
  }

  // Define all screenshots
  const screenshots: ScreenshotConfig[] = [
    { name: 'Add Tab', filename: '01-add-tab', action: async (page) => {
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Chat Tab', filename: '02-chat-tab', action: async (page) => {
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Transform Tab', filename: '03-transform-tab', action: async (page) => {
      await page.click('[data-tab="transform"]');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Library Tab', filename: '04-library-tab', action: async (page) => {
      await page.click('#header-library-btn');
      // Wait longer for async data loading
      await new Promise(resolve => setTimeout(resolve, 1000));
    }},
    { name: 'Settings Tab', filename: '05-settings-tab', action: async (page) => {
      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'AI Model Dropdown', filename: '06-ai-model-dropdown', action: async (page) => {
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 300));
      await page.click('#ai-model-btn');
      await new Promise(resolve => setTimeout(resolve, 300));
    }},
    { name: 'Notebook Select Dropdown', filename: '07-notebook-select-dropdown', action: async (page) => {
      await page.focus('#notebook-select');
      await page.click('#notebook-select');
      await new Promise(resolve => setTimeout(resolve, 300));
    }},
    { name: 'New Notebook Dialog', filename: '08-new-notebook-dialog', action: async (page) => {
      await page.click('#new-notebook-btn');
      await new Promise(resolve => setTimeout(resolve, 300));
    }},
    { name: 'Transform Options', filename: '09-transform-options', action: async (page) => {
      await page.click('[data-tab="transform"]');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Settings Provider Config', filename: '10-settings-provider-config', action: async (page) => {
      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 300));
      await page.evaluate(() => {
        const section = document.querySelector('.provider-config');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Settings About', filename: '11-settings-about', action: async (page) => {
      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 300));
      await page.evaluate(() => {
        const section = document.querySelector('.about-section');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Library Sources List', filename: '12-library-sources-list', action: async (page) => {
      await page.click('#header-library-btn');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
    { name: 'Chat Empty State', filename: '13-chat-empty-state', action: async (page) => {
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 400));
    }},
  ];

  console.log(`Capturing ${screenshots.length} screenshots...\n`);

  for (const shot of screenshots) {
    try {
      const page = await getFreshPage();
      await shot.action(page);
      await capture(page, shot.filename);
      await page.close();
    } catch (err) {
      console.error(`  ✗ ${shot.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Full viewport shot (reuse the last page)
  try {
    const page = await getFreshPage();
    await page.click('[data-tab="add"]');
    await new Promise(resolve => setTimeout(resolve, 400));
    const filepath = path.join(SCREENSHOT_DIR, '00-full-sidepanel-default.png');
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`  ✓ 00-full-sidepanel-default.png (viewport only)`);
    await page.close();
  } catch (err) {
    console.error(`  ✗ Full viewport screenshot failed:`, err instanceof Error ? err.message : err);
  }

  console.log(`\nDone! Screenshots saved to: ${SCREENSHOT_DIR}`);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
