/**
 * Sidepanel E2E Tests
 *
 * Tests for the FolioLM sidepanel UI including navigation,
 * notebook management, and basic interactions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  getSidepanelPage,
  waitForElement,
  cleanupBrowser,
} from './setup';

describe('Sidepanel', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;

  beforeAll(async () => {
    browser = await launchWithExtension();
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  describe('Page Loading', () => {
    it('should load the sidepanel page', async () => {
      const page = await getSidepanelPage(browser);
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    it('should display bottom navigation', async () => {
      const page = await getSidepanelPage(browser);
      await waitForElement(page, '.bottom-nav');
      const nav = await page.$('.bottom-nav');
      expect(nav).toBeTruthy();
    });

    it('should display tab buttons', async () => {
      const page = await getSidepanelPage(browser);

      await waitForElement(page, '[data-tab="add"]');
      await waitForElement(page, '[data-tab="chat"]');
      await waitForElement(page, '[data-tab="transform"]');

      const addTab = await page.$('[data-tab="add"]');
      const chatTab = await page.$('[data-tab="chat"]');
      const transformTab = await page.$('[data-tab="transform"]');

      expect(addTab).toBeTruthy();
      expect(chatTab).toBeTruthy();
      expect(transformTab).toBeTruthy();
    });
  });

  describe('Bottom Navigation', () => {
    it('should navigate to Add tab when Add button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the Add button in bottom nav
      await page.click('[data-tab="add"]');

      // Wait for the add tab to become active
      await page.waitForFunction(
        () => {
          const addTab = document.getElementById('tab-add');
          return addTab && addTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify the nav item has active class
      const isActive = await page.$eval('[data-tab="add"]',
        (el) => el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    it('should navigate to Chat tab when Chat button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the Chat button in bottom nav
      await page.click('[data-tab="chat"]');

      // Wait for the chat tab to become active
      await page.waitForFunction(
        () => {
          const chatTab = document.getElementById('tab-chat');
          return chatTab && chatTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify the nav item has active class
      const isActive = await page.$eval('[data-tab="chat"]',
        (el) => el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });

    it('should navigate to Transform tab when Transform button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the Transform button in bottom nav
      await page.click('[data-tab="transform"]');

      // Wait for the transform tab to become active
      await page.waitForFunction(
        () => {
          const transformTab = document.getElementById('tab-transform');
          return transformTab && transformTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify the nav item has active class
      const isActive = await page.$eval('[data-tab="transform"]',
        (el) => el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    });
  });

  describe('Header Navigation', () => {
    it('should navigate to Library tab when Library button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the Library button in header
      await page.click('#header-library-btn');

      // Wait for the library tab to become active
      await page.waitForFunction(
        () => {
          const libraryTab = document.getElementById('tab-library');
          return libraryTab && libraryTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify the library tab is visible
      const isVisible = await page.$eval('#tab-library',
        (el) => window.getComputedStyle(el).display === 'block'
      );
      expect(isVisible).toBe(true);
    });

    it('should navigate to Settings tab when Settings button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the Settings button in header
      await page.click('#header-settings-btn');

      // Wait for the settings tab to become active
      await page.waitForFunction(
        () => {
          const settingsTab = document.getElementById('tab-settings');
          return settingsTab && settingsTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify the settings tab is visible
      const isVisible = await page.$eval('#tab-settings',
        (el) => window.getComputedStyle(el).display === 'block'
      );
      expect(isVisible).toBe(true);
    });

    it('should open AI model dropdown when AI Model button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the AI Model button in header
      await page.click('#ai-model-btn');

      // Wait for the dropdown to become visible (remove hidden class)
      await page.waitForFunction(
        () => {
          const dropdown = document.getElementById('ai-model-dropdown');
          return dropdown && !dropdown.classList.contains('hidden');
        },
        { timeout: 5000 }
      );

      // Verify the dropdown is visible
      const isVisible = await page.$eval('#ai-model-dropdown',
        (el) => !el.classList.contains('hidden')
      );
      expect(isVisible).toBe(true);

      // Close the dropdown by clicking elsewhere
      await page.click('.header');
    });

    it('should open new notebook dialog when New Notebook button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Click the New Notebook button in header
      await page.click('#new-notebook-btn');

      // Wait for the dialog to appear
      await page.waitForSelector('#notebook-dialog', { timeout: 5000 });

      // Verify the dialog is visible
      const dialogExists = await page.$('#notebook-dialog');
      expect(dialogExists).toBeTruthy();

      // Close the dialog by clicking cancel (if it appeared)
      const cancelBtn = await page.$('#notebook-dialog-cancel');
      if (cancelBtn) {
        await page.evaluate((btn) => (btn as HTMLButtonElement).click(), cancelBtn);
      }
    });
  });
});
