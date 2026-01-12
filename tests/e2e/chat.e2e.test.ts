/**
 * Chat E2E Tests
 *
 * Tests for the LLM chat functionality including sending messages,
 * receiving responses, and verifying the chat UI interactions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  getSidepanelPage,
  waitForElement,
  cleanupBrowser,
} from './setup';

describe('Chat', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;

  beforeAll(async () => {
    browser = await launchWithExtension();
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  describe('Chat UI', () => {
    it('should display chat input', async () => {
      const page = await getSidepanelPage(browser);

      // Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-input');

      const queryInput = await page.$('#query-input');
      expect(queryInput).toBeTruthy();
    });

    it('should display send button', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-btn');

      const queryBtn = await page.$('#query-btn');
      expect(queryBtn).toBeTruthy();
    });

    it('should display chat messages container', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#chat-messages');

      const chatMessages = await page.$('#chat-messages');
      expect(chatMessages).toBeTruthy();
    });
  });

  describe('Chat Interaction', () => {
    it('should type a message in the chat input', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-input');

      // Type a message
      await page.type('#query-input', 'Hello, this is a test message');

      // Verify the input has the message
      const inputValue = await page.$eval('#query-input',
        (el) => (el as HTMLInputElement).value
      );
      expect(inputValue).toBe('Hello, this is a test message');
    });

    it('should clear input and attempt to send message', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-input');

      // Clear any existing messages
      const hasClearBtn = await page.$('#clear-chat-btn');
      if (hasClearBtn) {
        await page.click('#clear-chat-btn');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Type and send a message (this should work even without sources now)
      await page.type('#query-input', 'Hello!');
      await page.click('#query-btn');

      // Wait a moment for the input to be cleared
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify input was cleared (happens immediately when chat starts)
      const inputValue = await page.$eval('#query-input',
        (el) => (el as HTMLInputElement).value
      );
      // Input should be cleared either by successful send or by error handling
      expect(inputValue).toBe('');
    });
  });

  describe('Chat Response', () => {
    it('should attempt to send chat message', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-input');

      // Clear any existing messages
      const hasClearBtn = await page.$('#clear-chat-btn');
      if (hasClearBtn) {
        await page.click('#clear-chat-btn');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Type and send a message
      await page.type('#query-input', 'Test message');
      await page.click('#query-btn');

      // Wait a moment for the input to be cleared
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify input was cleared
      const inputValueAfter = await page.$eval('#query-input',
        (el) => (el as HTMLInputElement).value
      );
      expect(inputValueAfter).toBe('');

      // Note: With fresh profile and no AI config, the chat will fail
      // but the UI should have responded by clearing the input
    });
  });

  describe('Chat Status', () => {
    it('should show chat status message', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#chat-status');

      const chatStatus = await page.$('#chat-status');
      expect(chatStatus).toBeTruthy();
    });

    it('should update status while processing', async () => {
      const page = await getSidepanelPage(browser);

      await page.click('[data-tab="chat"]');
      await waitForElement(page, '#query-input');

      // Send a message
      await page.type('#query-input', 'Test query');
      await page.click('#query-btn');

      // Check that status changes (may say "Preparing..." or show error)
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedStatus = await page.$eval('#chat-status',
        (el) => el.textContent
      );

      // Status should have changed or show some feedback
      expect(updatedStatus).toBeTruthy();
    });
  });
});
