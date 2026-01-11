/**
 * Onboarding E2E Tests
 *
 * Tests for the first-run onboarding experience including stepping
 * through all onboarding steps and completing the flow.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  cleanupBrowser,
  getExtensionIdFromBrowser,
} from './setup';

describe('Onboarding', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;
  let extensionId: string;

  beforeAll(async () => {
    browser = await launchWithExtension();
    extensionId = await getExtensionIdFromBrowser(browser);
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  describe('Onboarding Flow', () => {
    it('should display onboarding overlay on first visit', async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await page.waitForSelector('body', { timeout: 5000 });

      // Wait for onboarding to appear
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check that onboarding overlay is visible (not hidden)
      const onboardingVisible = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && !overlay.classList.contains('hidden');
      });

      expect(onboardingVisible).toBe(true);

      await page.close();
    });

    it('should display first onboarding step correctly', async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await page.waitForSelector('body', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check first step title
      const title = await page.$eval('#onboarding-title',
        (el) => el.textContent
      );
      expect(title).toBe('Welcome to FolioLM');

      // Check first step description
      const description = await page.$eval('#onboarding-description',
        (el) => el.textContent
      );
      expect(description).toBe('Collect web content from tabs, bookmarks, and history. Query and transform your sources using AI.');

      // Check that dots show 5 steps
      const dotCount = await page.$eval('#onboarding-dots',
        (el) => el.children.length
      );
      expect(dotCount).toBe(5);

      // Check first dot is active
      const firstDotActive = await page.evaluate(() => {
        const dots = document.getElementById('onboarding-dots');
        return dots && dots.children[0] && dots.children[0].classList.contains('active');
      });
      expect(firstDotActive).toBe(true);

      // Check button text is "Next"
      const nextButtonText = await page.$eval('#onboarding-next',
        (el) => (el as HTMLButtonElement).textContent
      );
      expect(nextButtonText).toBe('Next');

      await page.close();
    });

    it('should allow skipping onboarding', async () => {
      // This test must run before onboarding completion tests
      // since storage persists across all pages
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await page.waitForSelector('body', { timeout: 5000 });

      // Wait for onboarding to appear
      await page.waitForFunction(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && !overlay.classList.contains('hidden');
      }, { timeout: 3000 });

      // Verify onboarding is shown
      const onboardingVisible = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && !overlay.classList.contains('hidden');
      });
      expect(onboardingVisible).toBe(true);

      // Click Skip button
      await page.evaluate(() => {
        const btn = document.getElementById('onboarding-skip') as HTMLButtonElement;
        btn.click();
      });
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify overlay is hidden
      const onboardingHidden = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && overlay.classList.contains('hidden');
      });
      expect(onboardingHidden).toBe(true);

      await page.close();
    });

    it('should complete onboarding and hide overlay', async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await page.waitForSelector('body', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click through all steps to complete onboarding
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          const btn = document.getElementById('onboarding-next') as HTMLButtonElement;
          btn.click();
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Wait for overlay to be hidden
      await page.waitForFunction(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && overlay.classList.contains('hidden');
      }, { timeout: 3000 });

      // Verify overlay is hidden
      const onboardingHidden = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && overlay.classList.contains('hidden');
      });
      expect(onboardingHidden).toBe(true);

      await page.close();
    });

    it('should not show onboarding after completion', async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await page.waitForSelector('body', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check that onboarding overlay is hidden
      const onboardingHidden = await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        return overlay && overlay.classList.contains('hidden');
      });
      expect(onboardingHidden).toBe(true);

      await page.close();
    });
  });
});
