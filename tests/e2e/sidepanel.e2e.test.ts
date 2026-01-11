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

  describe('Settings Access', () => {
    it('should display settings button', async () => {
      const page = await getSidepanelPage(browser);
      await waitForElement(page, '#header-settings-btn');
      const settingsBtn = await page.$('#header-settings-btn');
      expect(settingsBtn).toBeTruthy();
    });

    it('should navigate to settings when button is clicked', async () => {
      const page = await getSidepanelPage(browser);

      // Wait for initialization to complete (check for an element that's rendered after init)
      await waitForElement(page, '#tab-add');

      await page.click('#header-settings-btn');

      // Wait for settings tab to become visible (active class added)
      await page.waitForFunction(
        () => {
          const settingsTab = document.getElementById('tab-settings');
          return settingsTab && settingsTab.classList.contains('active');
        },
        { timeout: 5000 }
      );

      // Verify it's visible
      const isVisible = await page.$eval('#tab-settings',
        (el) => window.getComputedStyle(el).display === 'block'
      );
      expect(isVisible).toBe(true);
    });
  });
});
