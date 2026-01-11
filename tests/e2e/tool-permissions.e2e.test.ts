/**
 * Tool Permissions E2E Tests
 *
 * Tests for the tool permissions settings UI including toggling
 * tool visibility and approval requirements.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  getSidepanelPage,
  waitForElement,
  cleanupBrowser,
} from './setup';

describe('Tool Permissions', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;

  beforeAll(async () => {
    browser = await launchWithExtension();
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });
  describe('Settings Navigation', () => {
    it('should navigate to settings', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 200));

      await waitForElement(page, '#tab-settings');
      const settingsTab = await page.$('#tab-settings');
      expect(settingsTab).toBeTruthy();
    });
  });

  describe('Tool Permissions UI', () => {
    it('should display tool permissions section', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 200));

      await waitForElement(page, '#tool-permissions-list');
      const toolPermissionsList = await page.$('#tool-permissions-list');
      expect(toolPermissionsList).toBeTruthy();
    });

    it('should display reset button', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 200));

      await waitForElement(page, '#reset-tool-permissions-btn');
      const resetButton = await page.$('#reset-tool-permissions-btn');
      expect(resetButton).toBeTruthy();
    });
  });

  describe('Tool Permission Items', () => {
    it('should display source tools', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check for listSources tool
      await waitForElement(page, '#tool-enabled-listSources');
      const listSourcesCheckbox = await page.$('#tool-enabled-listSources');
      expect(listSourcesCheckbox).toBeTruthy();
    });

    it('should display browser tools', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('#header-settings-btn');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check for listWindows tool
      await waitForElement(page, '#tool-enabled-listWindows');
      const listWindowsCheckbox = await page.$('#tool-enabled-listWindows');
      expect(listWindowsCheckbox).toBeTruthy();
    });
  });
});
