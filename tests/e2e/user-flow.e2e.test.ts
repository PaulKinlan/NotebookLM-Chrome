/**
 * User Flow E2E Tests
 *
 * Tests for the complete user journey: create notebook → add sources → chat with AI
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  cleanupBrowser,
  getSidepanelPage,
} from './setup';

describe('User Flow', () => {
  let browser: Awaited<ReturnType<typeof launchWithExtension>>;

  beforeAll(async () => {
    browser = await launchWithExtension();
  });

  afterAll(async () => {
    await cleanupBrowser(browser);
  });

  describe('Complete User Journey', () => {
    it('should create notebook and verify it exists', async () => {
      const page = await getSidepanelPage(browser);

      // Verify we have a notebook (already created by getSidepanelPage)
      const notebookValue = await page.$eval('#notebook-select',
        (el) => (el as HTMLSelectElement).value
      );

      expect(notebookValue).toBeTruthy();
      expect(notebookValue).not.toBe('');

      await page.close();
    });

    it('should add a source from current tab', async () => {
      const page = await getSidepanelPage(browser);

      // Navigate to Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify Add tab is active
      const addTabActive = await page.evaluate(() => {
        const addTab = document.getElementById('tab-add');
        return addTab && addTab.classList.contains('active');
      });
      expect(addTabActive).toBe(true);

      // Get the current notebook ID and create a source via IndexedDB
      const notebookId = await page.evaluate(() => {
        const select = document.getElementById('notebook-select') as HTMLSelectElement;
        return select.value;
      });

      // Create a source directly via IndexedDB to simulate adding a source
      // This simulates what happens when the "Add Current Tab" button is clicked
      await page.evaluate((nbId) => {
        return new Promise<void>((resolve, reject) => {
          // Generate a unique ID for the source
          const sourceId = `source_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

          // Open IndexedDB and add the source
          const request = indexedDB.open('notebooklm-chrome', 6);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sources'], 'readwrite');
            const store = transaction.objectStore('sources');

            const source = {
              id: sourceId,
              notebookId: nbId,
              type: 'tab',
              url: 'https://example.com/test-page',
              title: 'Test Source Page',
              content: '# Test Source Page\n\nThis is a test page for E2E testing.',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const addRequest = store.add(source);

            addRequest.onerror = () => reject(addRequest.error);
            addRequest.onsuccess = () => {
              db.close();
              resolve();
            };
          };

          request.onupgradeneeded = () => {
            // Database should already exist at this version
            const db = request.result;
            if (!db.objectStoreNames.contains('sources')) {
              const sourcesStore = db.createObjectStore('sources', { keyPath: 'id' });
              sourcesStore.createIndex('notebookId', 'notebookId', { unique: false });
            }
          };
        });
      }, notebookId);

      // Wait a moment for storage to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Trigger a reload of sources by switching to chat tab and back
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for source to appear in the list
      await page.waitForFunction(() => {
        const sourcesList = document.getElementById('active-sources');
        if (!sourcesList) return false;

        const sourceItems = sourcesList.querySelectorAll('.source-item');
        return sourceItems.length > 0;
      }, { timeout: 5000 });

      // Verify source was added
      const sourceCount = await page.evaluate(() => {
        const sourcesList = document.getElementById('active-sources');
        if (!sourcesList) return 0;

        const sourceItems = sourcesList.querySelectorAll('.source-item');
        return sourceItems.length;
      });

      expect(sourceCount).toBeGreaterThan(0);

      // Get the title of the added source
      const sourceTitle = await page.evaluate(() => {
        const sourcesList = document.getElementById('active-sources');
        if (!sourcesList) return '';

        const firstSource = sourcesList.querySelector('.source-item');
        if (!firstSource) return '';

        const titleEl = firstSource.querySelector('.source-title');
        return titleEl ? titleEl.textContent : '';
      });

      // Source title should be present
      expect(sourceTitle).toBeTruthy();
      expect(sourceTitle.length).toBeGreaterThan(0);

      await page.close();
    });

    it('should send a chat message with sources available', async () => {
      const page = await getSidepanelPage(browser);

      // Navigate to Chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify chat tab is active
      const chatTabActive = await page.evaluate(() => {
        const chatTab = document.getElementById('tab-chat');
        return chatTab && chatTab.classList.contains('active');
      });
      expect(chatTabActive).toBe(true);

      // Check source count is displayed
      const sourceCount = await page.evaluate(() => {
        const sourceCountEl = document.getElementById('source-count');
        return sourceCountEl ? sourceCountEl.textContent : '';
      });

      expect(sourceCount).toBeTruthy();
      expect(sourceCount).not.toBe('0 sources');
      expect(sourceCount).not.toBe('No sources');

      // Send a chat message asking about sources
      const query = 'What sources do I have?';

      // Set the input value directly
      await page.evaluate((text) => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify input has the message
      const inputValue = await page.$eval('#query-input',
        (el) => (el as HTMLInputElement).value
      );
      expect(inputValue).toBe(query);

      // Click send button
      await page.evaluate(() => {
        const btn = document.getElementById('query-btn') as HTMLButtonElement;
        btn.click();
      });

      // Wait for input to be cleared (message sent)
      await page.waitForFunction(() => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        return input.value === '';
      }, { timeout: 5000 });

      // Wait for user message to appear in chat
      // Don't rely on count comparison as there might be existing messages
      await page.waitForFunction(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return false;

        const messages = chatMessages.querySelectorAll('.chat-message.user');
        return messages.length > 0;
      }, { timeout: 5000 });

      // Verify the user message is displayed
      const userMessageDisplayed = await page.evaluate((queryText) => {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return false;

        const messages = Array.from(chatMessages.querySelectorAll('.chat-message'));
        for (const msg of messages) {
          if (msg.classList.contains('user')) {
            const content = msg.querySelector('.chat-message-content');
            if (content && content.textContent?.includes(queryText)) {
              return true;
            }
          }
        }
        return false;
      }, query);

      expect(userMessageDisplayed).toBe(true);

      // Verify assistant message section is created
      const hasAssistantMessage = await page.evaluate(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return false;

        const messages = Array.from(chatMessages.querySelectorAll('.chat-message'));
        for (const msg of messages) {
          if (msg.classList.contains('assistant')) {
            return true;
          }
        }
        return false;
      });

      expect(hasAssistantMessage).toBe(true);

      await page.close();
    });

    it('should display sources in Add tab', async () => {
      const page = await getSidepanelPage(browser);

      // Navigate to Add tab
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify Add tab is active
      const addTabActive = await page.evaluate(() => {
        const addTab = document.getElementById('tab-add');
        return addTab && addTab.classList.contains('active');
      });
      expect(addTabActive).toBe(true);

      // Get the current notebook ID and create a source via IndexedDB
      const notebookId = await page.evaluate(() => {
        const select = document.getElementById('notebook-select') as HTMLSelectElement;
        return select.value;
      });

      // Create a source directly via IndexedDB
      await page.evaluate((nbId) => {
        return new Promise<void>((resolve, reject) => {
          const sourceId = `source_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const request = indexedDB.open('notebooklm-chrome', 6);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['sources'], 'readwrite');
            const store = transaction.objectStore('sources');

            const source = {
              id: sourceId,
              notebookId: nbId,
              type: 'tab',
              url: 'https://example.com/e2e-test-source',
              title: 'E2E Test Source',
              content: '# E2E Test Source\n\nThis is a test source for E2E testing.',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const addRequest = store.add(source);
            addRequest.onerror = () => reject(addRequest.error);
            addRequest.onsuccess = () => {
              db.close();
              resolve();
            };
          };

          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sources')) {
              const sourcesStore = db.createObjectStore('sources', { keyPath: 'id' });
              sourcesStore.createIndex('notebookId', 'notebookId', { unique: false });
            }
          };
        });
      }, notebookId);

      // Wait for storage to update and trigger a reload by switching tabs
      await new Promise(resolve => setTimeout(resolve, 500));
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));
      await page.click('[data-tab="add"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Wait for source to appear in the list
      await page.waitForFunction(() => {
        const sourcesList = document.getElementById('active-sources');
        if (!sourcesList) return false;
        const sourceItems = sourcesList.querySelectorAll('.source-item');
        return sourceItems.length > 0;
      }, { timeout: 5000 });

      // Verify source is displayed and has the expected title
      const firstSourceTitle = await page.evaluate(() => {
        const sourcesList = document.getElementById('active-sources');
        if (!sourcesList) return '';
        const firstSource = sourcesList.querySelector('.source-item');
        if (!firstSource) return '';
        const titleEl = firstSource.querySelector('.source-title');
        return titleEl ? titleEl.textContent?.trim() : '';
      });

      expect(firstSourceTitle).toBe('E2E Test Source');

      await page.close();
    });
  });
});
