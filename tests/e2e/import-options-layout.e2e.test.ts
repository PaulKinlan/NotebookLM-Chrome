/**
 * Import Options Layout E2E Test
 *
 * Tests whether the import options layout remains correct
 * after switching between tabs (specifically Transform -> Add).
 *
 * Issue: Import options appear horizontally instead of vertically
 * after switching from Transform tab to Add tab.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  launchWithExtension,
  getSidepanelPage,
  cleanupBrowser,
} from './setup';

describe('Import Options Layout', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;
  let page: Awaited<ReturnType<typeof getSidepanelPage>>;

  // Helper to take screenshots
  async function takeScreenshot(name: string) {
    const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots', 'layout-debug');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const filepath = path.join(screenshotsDir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${filepath}`);
  }

  beforeAll(async () => {
    browser = await launchWithExtension();
    page = await getSidepanelPage(browser);
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  describe('Initial Load', () => {
    it('should have vertically stacked import options on Add tab', async () => {
      // Navigate to Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get the import options container
      const result = await page.evaluate(() => {
        const importOptionsDiv = document.querySelector('._importOptions_c96ws_66');
        if (!importOptionsDiv) {
          return {
            found: false,
            error: 'importOptions div not found with CSS module class'
          };
        }

        const style = window.getComputedStyle(importOptionsDiv);
        return {
          found: true,
          className: importOptionsDiv.className,
          display: style.display,
          flexDirection: style.flexDirection,
          gap: style.gap,
          childCount: importOptionsDiv.children.length
        };
      });

      console.log('[TEST] Initial load result:', result);

      expect(result.found).toBe(true);
      expect(result.display).toBe('flex');
      expect(result.flexDirection).toBe('column');
      expect(result.childCount).toBe(4); // 4 import option cards
    });
  });

  describe('After Tab Switch (Transform -> Add)', () => {
    it('should maintain vertical layout after switching from Transform to Add', async () => {
      // First, capture initial state on Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now go to Transform tab
      await page.click('[data-tab="transform"]');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now switch back to Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check import options layout
      const importResult = await page.evaluate(() => {
        const importOptionsDiv = document.querySelector('._importOptions_c96ws_66');
        if (!importOptionsDiv) {
          return {
            found: false,
            error: 'importOptions div not found with CSS module class'
          };
        }

        const style = window.getComputedStyle(importOptionsDiv);

        // Also check if transformGrid class is somehow still affecting this
        const hasTransformGridClass = importOptionsDiv.classList.contains('_transformGrid_105vk_5');

        return {
          found: true,
          className: importOptionsDiv.className,
          display: style.display,
          flexDirection: style.flexDirection,
          gap: style.gap,
          hasTransformGridClass,
          childCount: importOptionsDiv.children.length,
        };
      });

      console.log('[TEST] After tab switch result:', JSON.stringify(importResult, null, 2));

      expect(importResult.found).toBe(true);
      expect(importResult.hasTransformGridClass).toBe(false);

      // The critical check: should be flex with column direction, NOT grid
      expect(importResult.display).toBe('flex');
      expect(importResult.flexDirection).toBe('column');
    });
  });

  describe('Multiple Tab Switches', () => {
    it('should maintain layout after multiple tab switches', async () => {
      // Start on Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Switch: Add -> Transform -> Chat -> Add
      await page.click('[data-tab="transform"]');
      await new Promise(resolve => setTimeout(resolve, 300));

      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 300));

      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Final check
      const result = await page.evaluate(() => {
        const importOptionsDiv = document.querySelector('._importOptions_c96ws_66');
        if (!importOptionsDiv) return { found: false };

        const style = window.getComputedStyle(importOptionsDiv);
        return {
          found: true,
          display: style.display,
          flexDirection: style.flexDirection,
          childCount: importOptionsDiv.children.length
        };
      });

      console.log('[TEST] After multiple switches result:', result);

      expect(result.found).toBe(true);
      expect(result.display).toBe('flex');
      expect(result.flexDirection).toBe('column');
    });
  });
});
