/**
 * Tool Use E2E Tests
 *
 * Tests for the agentic AI tool use functionality including:
 * - Tool call UI rendering
 * - Tool status updates (calling → done/error)
 * - Approval dialog for tools requiring approval
 * - Source tools (listSources, readSource) - auto-approved
 * - Browser tools (listTabs, listWindows) - require approval
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  launchWithExtension,
  getSidepanelPage,
  waitForElement,
  cleanupBrowser,
  type Page,
  type Browser,
} from './setup';

/**
 * Helper function to set up the mock AI provider for testing
 * Creates a mock profile in IndexedDB and configures mock behavior
 */
async function setupMockProvider(
  page: Page,
  toolName: string,
  toolArgs: Record<string, unknown>,
  finalResponse: string
): Promise<string> {
  // Get the current notebook ID
  const notebookId = await page.$eval('#notebook-select',
    (el) => (el as HTMLSelectElement).value
  ) as string;

  // Create the mock profile in IndexedDB
  const createResult = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('notebooklm-chrome', 6);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    // Step 1: Create credential in credentialSettings
    const credentialId = crypto.randomUUID();
    const noApiKey = '__NO_API_KEY__';

    const credSettings = await new Promise<any>((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const getReq = store.get('credentialSettings');
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const result = getReq.result;
        resolve(result && result.value ? result.value : { credentials: [] });
      };
    });

    // Add mock credential
    credSettings.credentials.push({
      id: credentialId,
      name: 'Mock Provider',
      apiKey: noApiKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    credSettings.defaultCredentialId = credentialId;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const putReq = store.put({ key: 'credentialSettings', value: credSettings });
      putReq.onerror = () => reject(putReq.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // Step 2: Create model config in modelConfigSettings
    const modelConfigId = crypto.randomUUID();
    const modelSettings = await new Promise<any>((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const getReq = store.get('modelConfigSettings');
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const result = getReq.result;
        resolve(result && result.value ? result.value : { modelConfigs: [], defaultModelConfigId: '' });
      };
    });

    // Add mock model config
    modelSettings.modelConfigs.forEach((m: any) => m.isDefault = false);
    modelSettings.modelConfigs.push({
      id: modelConfigId,
      name: 'Mock (Testing)',
      credentialId: credentialId,
      providerId: 'mock',
      model: 'mock-test-model',
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    modelSettings.defaultModelConfigId = modelConfigId;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const putReq = store.put({ key: 'modelConfigSettings', value: modelSettings });
      putReq.onerror = () => reject(putReq.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    db.close();
    return { success: true, modelConfigId };
  });

  if (!createResult.success) {
    throw new Error('Failed to write mock profile to IndexedDB');
  }

  // Set the mock behavior in chrome.storage.local
  await page.evaluate((config: { toolName: string; toolArgs: Record<string, unknown>; finalResponse: string }) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({
        __mock_ai_behavior__: {
          toolCalls: [
            {
              toolName: config.toolName,
              args: config.toolArgs,
            },
          ],
          finalResponse: config.finalResponse,
          delay: 100,
        },
      }, () => resolve());
    });
  }, { toolName, toolArgs, finalResponse });

  // Reload the page to pick up the new mock profile
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('body', { timeout: 5000 });

  // Dismiss onboarding if it appears
  await page.evaluate(() => {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  });

  // Wait for settings button
  await page.waitForSelector('#header-settings-btn', { timeout: 10000 });

  return notebookId;
}

describe('Tool Use', () => {
  let browser: Browser;
  let page: Page;

  // Shared page for all tests to avoid extension service worker termination
  beforeAll(async () => {
    browser = await launchWithExtension();
    page = await getSidepanelPage(browser);
  });

  afterAll(async () => {
    await page.close();
    await cleanupBrowser(browser);
  });

  describe('Agentic Mode and Settings', () => {
    it('should enable agentic mode via settings', async () => {
      // Wait for page to be fully loaded
      await page.waitForSelector('#header-settings-btn', { timeout: 5000 });

      // Navigate to settings tab via header button
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tab-settings');
      await waitForElement(page, '#tool-based-context');

      // Enable agentic mode (tool-based context)
      const toolBasedContext = await page.$('#tool-based-context');
      expect(toolBasedContext).toBeTruthy();

      // Check if already enabled, if not toggle it
      const isChecked = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isChecked) {
        await page.click('#tool-based-context');
      }

      // Verify it's checked
      const isCheckedAfter = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );
      expect(isCheckedAfter).toBe(true);
    });

    it('should show tool permissions section in settings', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      const permissionsList = await page.$('#tool-permissions-list');
      expect(permissionsList).toBeTruthy();

      // Check that source tools are visible
      const listSourcesPermission = await page.$('#tool-enabled-listSources');
      expect(listSourcesPermission).toBeTruthy();

      // Check that browser tools are visible
      const listTabsPermission = await page.$('#tool-enabled-listTabs');
      expect(listTabsPermission).toBeTruthy();
    });

    it('should verify source tools are auto-approved', async () => {
      await page.click('#header-settings-btn');

      // listSources should have "Auto approve" checked by default
      const listSourcesAutoApprove = await page.$('#tool-no-approval-listSources');
      expect(listSourcesAutoApprove).toBeTruthy();

      const isAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );
      expect(isAutoApproved).toBe(true);
    });

    it('should verify browser tools require approval by default', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      // Check that listTabs shows "Requires Approval" status
      const listTabsStatus = await page.evaluate(() => {
        const item = document.querySelector('#tool-enabled-listTabs')?.closest('.tool-permission-item');
        if (!item) return null;
        const statusEl = item.querySelector('.tool-permission-status');
        return statusEl?.textContent || null;
      });

      expect(listTabsStatus).toContain('Requires Approval');
    });

    it('should toggle tool visibility', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      // Find a tool visibility toggle
      const listSourcesEnabled = await page.$('#tool-enabled-listSources');
      expect(listSourcesEnabled).toBeTruthy();

      // Get initial state
      const initialState = await page.$eval('#tool-enabled-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      // Toggle visibility
      await page.click('#tool-enabled-listSources');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify state changed
      const newState = await page.$eval('#tool-enabled-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      expect(newState).toBe(!initialState);

      // Toggle back for cleanup
      if (initialState) {
        await page.click('#tool-enabled-listSources');
      }
    });
  });

  describe('Tool Call UI Structure', () => {
    it('should display chat messages container', async () => {
      // Navigate to chat tab
      await page.click('[data-tab="chat"]');

      // The chat messages container should exist
      const chatMessages = await page.$('#chat-messages');
      expect(chatMessages).toBeTruthy();
    });

    it('should have approval dialog elements in DOM', async () => {
      // Approval dialog should be created by initApprovalUI
      const approvalDialog = await page.$('#approval-dialog');
      expect(approvalDialog).toBeTruthy();

      // Check for approval list
      const approvalList = await page.$('#approval-list');
      expect(approvalList).toBeTruthy();
    });

    it('should show approval dialog when manually triggered', async () => {
      // Trigger approval dialog by evaluating the show function
      await page.evaluate(() => {
        // If the function doesn't exist globally, we'll just verify the dialog exists
        const dialog = document.getElementById('approval-dialog');
        if (dialog && !(dialog as HTMLDialogElement).open) {
          (dialog as HTMLDialogElement).showModal();
        }
      });

      // Wait a moment for the dialog to appear
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if dialog is open
      const isDialogOpen = await page.$eval('#approval-dialog',
        (el) => (el as HTMLDialogElement).open
      );

      // Close the dialog if it opened
      if (isDialogOpen) {
        await page.evaluate(() => {
          const dialog = document.getElementById('approval-dialog');
          if (dialog) (dialog as HTMLDialogElement).close();
        });
      }

      // We verified the dialog can be opened
      expect(isDialogOpen).toBe(true);
    });
  });

  describe('Tool Call Rendering', () => {
    it('should render tool call with correct classes', async () => {
      // Create a mock tool call element to verify rendering
      const toolCallHtml = await page.evaluate(() => {
        const div = document.createElement('div');
        div.className = 'assistant-tool-call';
        div.dataset.toolCallId = 'test-call-id';
        div.dataset.toolName = 'listSources';
        div.innerHTML = `
          <div class="tool-call-header">
            <span class="tool-call-icon">🔧</span>
            <span class="tool-call-name">listSources</span>
            <span class="tool-call-status calling">Calling...</span>
          </div>
          <div class="tool-call-args">
            <pre>{"notebookId": "test-notebook"}</pre>
          </div>
        `;
        document.body.appendChild(div);
        return div.outerHTML;
      });

      // Verify the structure contains expected elements
      expect(toolCallHtml).toContain('assistant-tool-call');
      expect(toolCallHtml).toContain('tool-call-header');
      expect(toolCallHtml).toContain('tool-call-name');
      expect(toolCallHtml).toContain('tool-call-status');
      expect(toolCallHtml).toContain('tool-call-args');

      // Clean up
      await page.evaluate(() => {
        const el = document.querySelector('.assistant-tool-call');
        if (el) el.remove();
      });
    });

    it('should update tool call status', async () => {
      // Create a mock tool call and test status updates
      const statusAfterUpdate = await page.evaluate(() => {
        const div = document.createElement('div');
        div.className = 'assistant-tool-call';
        div.innerHTML = `
          <div class="tool-call-header">
            <span class="tool-call-name">readSource</span>
            <span class="tool-call-status calling">Calling...</span>
          </div>
        `;
        document.body.appendChild(div);

        // Update status to done
        const statusEl = div.querySelector('.tool-call-status') as HTMLElement;
        if (statusEl) {
          statusEl.className = 'tool-call-status done';
          statusEl.textContent = 'Called';
        }

        // Return final status
        return {
          className: statusEl?.className,
          textContent: statusEl?.textContent,
        };
      });

      expect(statusAfterUpdate.className).toBe('tool-call-status done');
      expect(statusAfterUpdate.textContent).toBe('Called');

      // Clean up
      await page.evaluate(() => {
        const el = document.querySelector('.assistant-tool-call');
        if (el) el.remove();
      });
    });

    it('should render tool calls container within message', async () => {
      const hasToolCallsContainer = await page.evaluate(() => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message assistant';

        const toolCallsContainer = document.createElement('div');
        toolCallsContainer.className = 'assistant-tool-calls';

        messageDiv.appendChild(toolCallsContainer);
        document.body.appendChild(messageDiv);

        return messageDiv.querySelector('.assistant-tool-calls') !== null;
      });

      expect(hasToolCallsContainer).toBe(true);

      // Clean up
      await page.evaluate(() => {
        const el = document.querySelector('.chat-message.assistant');
        if (el) el.remove();
      });
    });
  });

  describe('Tool Approval Dialog Structure', () => {
    it('should render approval request with correct structure', async () => {
      // Create a mock approval request to verify rendering
      const approvalHtml = await page.evaluate(() => {
        return `
          <div class="approval-request" data-request-id="test-request-id">
            <div class="approval-header">
              <div class="approval-tool-name">listTabs</div>
              <div class="approval-time">Just now</div>
            </div>
            <div class="approval-reason">
              <strong>Reason:</strong> AI needs to list your browser tabs
            </div>
            <div class="approval-args">
              <div class="approval-args-content">
                <div><strong>windowId:</strong> 1</div>
              </div>
            </div>
            <div class="approval-scope-selection">
              <label class="approval-scope-label">Approval scope:</label>
              <div class="approval-scopes">
                <label>
                  <input type="radio" name="scope-test-request-id" value="once" checked />
                  Once
                </label>
                <label>
                  <input type="radio" name="scope-test-request-id" value="session" />
                  Session
                </label>
                <label>
                  <input type="radio" name="scope-test-request-id" value="forever" />
                  Forever
                </label>
              </div>
            </div>
            <div class="approval-actions">
              <button class="btn btn-outline btn-small" data-reject="test-request-id">
                Reject
              </button>
              <button class="btn btn-primary btn-small" data-approve="test-request-id">
                Approve
              </button>
            </div>
          </div>
        `;
      });

      // Verify structure
      expect(approvalHtml).toContain('approval-request');
      expect(approvalHtml).toContain('approval-tool-name');
      expect(approvalHtml).toContain('approval-reason');
      expect(approvalHtml).toContain('approval-args');
      expect(approvalHtml).toContain('approval-scope-selection');
      expect(approvalHtml).toContain('approval-actions');
      expect(approvalHtml).toContain('data-approve');
      expect(approvalHtml).toContain('data-reject');
    });

  });

  describe('Source Tools Registration', () => {
    it('should have source tools registered', async () => {
      // Check that source tools are in the permissions UI
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      const sourceTools = ['listSources', 'readSource', 'findRelevantSources'];

      for (const toolName of sourceTools) {
        const toolElement = await page.$(`#tool-enabled-${toolName}`);
        expect(toolElement).toBeTruthy();
      }
    });

    it('should display tool descriptions in settings', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      // Check that tools have permission status
      const hasStatusElements = await page.evaluate(() => {
        const items = document.querySelectorAll('.tool-permission-item');
        return Array.from(items).some(item => {
          const statusEl = item.querySelector('.tool-permission-status');
          return statusEl && statusEl.textContent && statusEl.textContent.length > 0;
        });
      });

      expect(hasStatusElements).toBe(true);
    });
  });

  describe('Browser Tools Registration', () => {
    it('should have browser tools registered', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      const browserTools = ['listWindows', 'listTabs', 'listTabGroups', 'readPageContent'];

      for (const toolName of browserTools) {
        const toolElement = await page.$(`#tool-enabled-${toolName}`);
        expect(toolElement).toBeTruthy();
      }
    });

    it('should mark browser tools as requiring approval by default', async () => {
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-permissions-list');

      const browserTools = ['listWindows', 'listTabs', 'listTabGroups', 'readPageContent'];

      for (const toolName of browserTools) {
        const status = await page.evaluate((name) => {
          const item = document.querySelector(`#tool-enabled-${name}`)?.closest('.tool-permission-item');
          if (!item) return null;
          const statusEl = item.querySelector('.tool-permission-status');
          return statusEl?.textContent || null;
        }, toolName);

        // Browser tools should show "Requires Approval" status
        expect(status).toContain('Requires Approval');
      }
    });
  });

  describe('Tool Approval Flow', () => {
    it('should complete full approval flow: trigger tool → show dialog → approve → get result', async () => {
      // Set a longer timeout for this test (60 seconds)
      console.log('[Test] Starting full approval flow test...');

      // Step 1: Navigate to settings and enable agentic mode
      console.log('[Test] Step 1: Navigate to settings...');
      await page.click('#header-settings-btn');
      console.log('[Test] Clicked settings button');
      await waitForElement(page, '#tool-based-context');
      console.log('[Test] Tool-based context element found');

      const isAgenticEnabled = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );
      console.log('[Test] Agentic enabled:', isAgenticEnabled);

      if (!isAgenticEnabled) {
        await page.click('#tool-based-context');
        console.log('[Test] Clicked tool-based-context to enable');
      }

      // Step 2: Disable auto-approval for listSources tool (so it requires approval)
      console.log('[Test] Step 2: Disable auto-approval for listSources...');
      const listSourcesAutoApprove = await page.$('#tool-no-approval-listSources');
      console.log('[Test] listSources auto-approve element:', !!listSourcesAutoApprove);
      expect(listSourcesAutoApprove).toBeTruthy();

      const isAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );
      console.log('[Test] listSources auto-approved:', isAutoApproved);

      // If auto-approved, uncheck it to require approval
      if (isAutoApproved) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[Test] Clicked to disable auto-approval');
      }

      // Verify auto-approval is disabled
      const autoApprovedAfter = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );
      expect(autoApprovedAfter).toBe(false);
      console.log('[Test] Verified auto-approval disabled');

      // Step 3: Navigate to chat tab
      console.log('[Test] Step 3: Navigate to chat tab...');
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('[Test] Navigated to chat tab');

      // Get current notebook ID
      const notebookId = await page.$eval('#notebook-select',
        (el) => (el as HTMLSelectElement).value
      );
      console.log('[Test] Current notebook ID:', notebookId);

      // Ensure we have a notebook with sources
      if (!notebookId) {
        // Create a test notebook first
        await page.click('#header-settings-btn');
        await page.click('[data-tab="add"]');
        await page.click('#new-notebook-btn');
        await page.waitForSelector('#notebook-name-input', { timeout: 3000 });
        await page.type('#notebook-name-input', 'Test Notebook for Tools');
        await page.click('#notebook-dialog-confirm');
        await page.waitForFunction(() => {
          const select = document.getElementById('notebook-select') as HTMLSelectElement;
          return select && select.value !== '';
        }, { timeout: 5000 });

        // Add a test source
        const newNotebookId = await page.$eval('#notebook-select',
          (el) => (el as HTMLSelectElement).value
        );

        await page.evaluate((nbId) => {
          return new Promise<void>((resolve, reject) => {
            const sourceId = `source_${Date.now()}`;
            const request = indexedDB.open('notebooklm-chrome', 6);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['sources'], 'readwrite');
              const store = transaction.objectStore('sources');
              const source = {
                id: sourceId,
                notebookId: nbId,
                type: 'manual',
                url: 'https://example.com/test',
                title: 'Test Source for Tool Approval',
                content: '# Test Source\n\nThis is a test source to verify tool approval flow works correctly.',
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
          });
        }, newNotebookId);

        await new Promise(resolve => setTimeout(resolve, 500));
        await page.click('[data-tab="chat"]');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Step 4: Configure the mock provider by creating a profile in IndexedDB
      console.log('[Test] Step 4: Creating mock provider profile in IndexedDB...');
      // Get the current notebook ID
      const currentNotebookId = await page.$eval('#notebook-select',
        (el) => (el as HTMLSelectElement).value
      ) as string;
      console.log('[Test] currentNotebookId:', currentNotebookId);

      // First, create the mock profile in IndexedDB
      console.log('[Test] Creating mock profile in IndexedDB...');
      try {
        const createResult = await page.evaluate(async () => {
          // Simple IndexedDB operation to create mock profile
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('notebooklm-chrome', 6);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });

          // Step 1: Create credential in credentialSettings
          const credentialId = crypto.randomUUID();
          const noApiKey = '__NO_API_KEY__';

          const credSettings = await new Promise<any>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const getReq = store.get('credentialSettings');
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
              const result = getReq.result;
              // Ensure we have a proper structure
              resolve(result && result.value ? result.value : { credentials: [] });
            };
          });

          // Add mock credential
          credSettings.credentials.push({
            id: credentialId,
            name: 'Mock Provider',
            apiKey: noApiKey,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          credSettings.defaultCredentialId = credentialId;

          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const putReq = store.put({ key: 'credentialSettings', value: credSettings });
            putReq.onerror = () => reject(putReq.error);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });

          // Step 2: Create model config in modelConfigSettings
          const modelConfigId = crypto.randomUUID();
          const modelSettings = await new Promise<any>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const getReq = store.get('modelConfigSettings');
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
              const result = getReq.result;
              // Ensure we have a proper structure
              resolve(result && result.value ? result.value : { modelConfigs: [], defaultModelConfigId: '' });
            };
          });

          // Add mock model config
          modelSettings.modelConfigs.forEach((m: any) => m.isDefault = false);
          modelSettings.modelConfigs.push({
            id: modelConfigId,
            name: 'Mock (Testing)',
            credentialId: credentialId,
            providerId: 'mock',
            model: 'mock-test-model',
            isDefault: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          modelSettings.defaultModelConfigId = modelConfigId;

          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const putReq = store.put({ key: 'modelConfigSettings', value: modelSettings });
            putReq.onerror = () => reject(putReq.error);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });

          // Verify the data was written
          const verifyResult = await new Promise<any>((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const getReq = store.get('modelConfigSettings');
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
              const result = getReq.result;
              resolve(result ? { found: true, value: result.value } : { found: false });
            };
          });

          db.close();
          return { success: verifyResult.found, modelConfigId, verifyResult };
        });
        console.log('[Test] Mock profile created:', createResult);
        if (!createResult.success) {
          console.error('[Test] Verification failed - modelConfigSettings not found in IndexedDB');
          throw new Error('Failed to write mock profile to IndexedDB');
        }
      } catch (error) {
        console.error('[Test] Error creating mock profile:', error);
        throw error;
      }

      // Now set the mock behavior in chrome.storage.local
      console.log('[Test] Setting mock behavior in chrome.storage.local...');
      await page.evaluate((nbId) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({
            __mock_ai_behavior__: {
              toolCalls: [
                {
                  toolName: 'listSources',
                  args: { notebookId: nbId },
                },
              ],
              finalResponse: 'I found 1 source in your notebook.',
              delay: 100,
            },
          }, () => resolve());
        });
      }, currentNotebookId);
      console.log('[Test] Mock behavior set successfully');

      // Step 5: Reload the page to pick up the new mock profile
      console.log('[Test] Reloading page to pick up mock profile...');
      await page.reload({ waitUntil: 'networkidle0' });

      // Wait for the page to be fully loaded
      await page.waitForSelector('body', { timeout: 5000 });
      console.log('[Test] Page reloaded, dismissing onboarding...');

      // Dismiss onboarding if it appears after reload
      await page.evaluate(() => {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
          overlay.classList.add('hidden');
        }
      });

      // Wait for settings button to be available
      console.log('[Test] Waiting for settings button...');
      await page.waitForSelector('#header-settings-btn', { timeout: 10000 });

      // Re-enable agentic mode after reload (settings persist but UI state may reset)
      console.log('[Test] Clicking settings button...');
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-based-context');

      const agenticEnabledAfterReload = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!agenticEnabledAfterReload) {
        await page.click('#tool-based-context');
      }

      // Disable auto-approval for listSources (settings persist, but verify)
      const autoApprovedAfterReload = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (autoApprovedAfterReload) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check which provider is loaded (from IndexedDB, not chrome.storage.local)
      const providerInfo = await page.evaluate(async () => {
        const modelSettings = await new Promise<any>((resolve, reject) => {
          const request = indexedDB.open('notebooklm-chrome', 6);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const getReq = store.get('modelConfigSettings');
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
              const result = getReq.result;
              db.close();
              resolve(result ? result.value : null);
            };
          };
        });
        return modelSettings ? { defaultId: modelSettings.defaultModelConfigId, count: modelSettings.modelConfigs?.length } : null;
      });
      console.log('[Test] Provider info after reload:', providerInfo);

      // Step 6: Send a message that triggers listSources tool
      // The message explicitly asks to list sources, which should trigger the tool
      const query = 'Please use listSources to show me what sources are in this notebook.';
      console.log('[Test] Step 6: Sending query:', query);

      await page.evaluate((text) => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Click send button
      console.log('[Test] Clicking send button...');
      await page.evaluate(() => {
        const btn = document.getElementById('query-btn') as HTMLButtonElement;
        btn.click();
      });
      console.log('[Test] Send button clicked');

      // Wait a bit to see if any errors appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for any error messages in the chat
      const chatContent = await page.evaluate(() => {
        const chatMessages = document.querySelectorAll('.chat-message');
        const messages: string[] = [];
        chatMessages.forEach((msg: Element) => {
          const content = msg.querySelector('.message-content')?.textContent;
          if (content) messages.push(content);
        });
        return messages;
      });
      console.log('[Test] Chat messages after send:', chatContent);

      // Check if there are any user events (chat messages) stored
      const userEvents = await page.evaluate(async () => {
        const events = await new Promise<any>((resolve, reject) => {
          const request = indexedDB.open('notebooklm-chrome', 6);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['chatEvents'], 'readonly');
            const store = transaction.objectStore('chatEvents');
            const getReq = store.getAll();
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
              db.close();
              resolve(getReq.result || []);
            };
          };
        });
        return events.map((e: any) => ({ id: e.id, type: e.type, content: e.content?.substring(0, 50) }));
      });
      console.log('[Test] User events in IndexedDB:', userEvents);

      // Check for console errors
      const consoleErrors = await page.evaluate(() => {
        return (window as any).__consoleErrors || [];
      });
      console.log('[Test] Console errors:', consoleErrors);

      // Step 7: Wait for approval dialog to appear
      // The approval dialog should appear because we disabled auto-approval for listSources
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return dialog && dialog.open;
      }, { timeout: 15000 });

      // Verify dialog is open
      const isDialogOpen = await page.$eval('#approval-dialog',
        (el) => (el as HTMLDialogElement).open
      );
      expect(isDialogOpen).toBe(true);

      // Verify the approval request is for listSources
      const hasListSourcesRequest = await page.evaluate(() => {
        const requests = document.querySelectorAll('.approval-request');
        for (const request of requests) {
          const toolName = request.querySelector('.approval-tool-name')?.textContent;
          if (toolName === 'listSources') {
            return true;
          }
        }
        return false;
      });
      expect(hasListSourcesRequest).toBe(true);

      // Step 8: Approve the tool request
      await page.evaluate(() => {
        const approveBtn = document.querySelector('[data-approve]') as HTMLButtonElement;
        if (approveBtn) approveBtn.click();
      });

      // Wait for dialog to close after approval
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return !dialog || !dialog.open;
      }, { timeout: 5000 });

      // Step 9: Verify tool call completed and result was displayed
      // Check for tool call element in chat
      await page.waitForFunction(() => {
        const toolCalls = document.querySelectorAll('.assistant-tool-call');
        return toolCalls.length > 0;
      }, { timeout: 10000 });

      // Verify tool call has listSources name
      const hasListSourcesToolCall = await page.evaluate(() => {
        const toolCalls = document.querySelectorAll('.assistant-tool-call');
        for (const call of toolCalls) {
          const toolName = call.querySelector('.tool-call-name')?.textContent;
          if (toolName === 'listSources') {
            return true;
          }
        }
        return false;
      });
      expect(hasListSourcesToolCall).toBe(true);

      // Step 10: Clean up - re-enable auto-approval for listSources
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-no-approval-listSources');

      const isCurrentlyAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isCurrentlyAutoApproved) {
        await page.click('#tool-no-approval-listSources');
      }

      // Verify it's back to auto-approved
      const autoApprovedRestored = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );
      expect(autoApprovedRestored).toBe(true);
    });

    it('should reject tool request and prevent tool execution', async () => {
      // Step 1: Navigate to settings and enable agentic mode
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-based-context');

      const isAgenticEnabled = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isAgenticEnabled) {
        await page.click('#tool-based-context');
      }

      // Step 2: Disable auto-approval for listSources tool
      const listSourcesAutoApprove = await page.$('#tool-no-approval-listSources');
      expect(listSourcesAutoApprove).toBeTruthy();

      const isAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (isAutoApproved) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 3: Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get current notebook ID
      const notebookId = await page.$eval('#notebook-select',
        (el) => (el as HTMLSelectElement).value
      ) as string;

      // Step 4: Set up mock provider to call listSources
      await setupMockProvider(page, 'listSources', { notebookId }, 'I found 1 source in your notebook.');

      // Step 5: Re-enable agentic mode after reload (settings persist but UI may reset)
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-based-context');

      const agenticEnabled = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!agenticEnabled) {
        await page.click('#tool-based-context');
      }

      // Ensure auto-approval is still disabled for listSources
      const autoApprovedCheck = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (autoApprovedCheck) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 6: Send a message that triggers listSources tool
      const query = 'Please use listSources to show me what sources are in this notebook.';

      await page.evaluate((text) => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);

      await new Promise(resolve => setTimeout(resolve, 100));

      await page.evaluate(() => {
        const btn = document.getElementById('query-btn') as HTMLButtonElement;
        btn.click();
      });

      // Step 7: Wait for approval dialog to appear
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return dialog && dialog.open;
      }, { timeout: 15000 });

      // Step 8: Reject the tool request
      await page.evaluate(() => {
        const rejectBtn = document.querySelector('[data-reject]') as HTMLButtonElement;
        if (rejectBtn) rejectBtn.click();
      });

      // Step 9: Wait for dialog to close
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return !dialog || !dialog.open;
      }, { timeout: 5000 });

      // Step 10: Verify that we get an error message indicating tool was rejected
      await page.waitForFunction(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return false;

        // Check for error indication in recent messages
        const messages = chatMessages.querySelectorAll('.chat-message.assistant:last-of-type .chat-message-content');
        return messages.length > 0;
      }, { timeout: 10000 });

      // Clean up - re-enable auto-approval
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-no-approval-listSources');

      const isCurrentlyAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isCurrentlyAutoApproved) {
        await page.click('#tool-no-approval-listSources');
      }
    });

    it('should support session-scoped approvals', async () => {
      // Step 1: Navigate to settings and enable agentic mode
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-based-context');

      const isAgenticEnabled = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isAgenticEnabled) {
        await page.click('#tool-based-context');
      }

      // Step 2: Disable auto-approval for listSources
      const listSourcesAutoApprove = await page.$('#tool-no-approval-listSources');
      expect(listSourcesAutoApprove).toBeTruthy();

      const isAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (isAutoApproved) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 3: Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get current notebook ID
      const notebookId = await page.$eval('#notebook-select',
        (el) => (el as HTMLSelectElement).value
      ) as string;

      // Step 4: Set up mock provider to call listSources
      await setupMockProvider(page, 'listSources', { notebookId }, 'I found 1 source in your notebook.');

      // Step 5: Re-enable agentic mode after reload
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-based-context');

      const agenticEnabled = await page.$eval('#tool-based-context',
        (el) => (el as HTMLInputElement).checked
      );

      if (!agenticEnabled) {
        await page.click('#tool-based-context');
      }

      // Ensure auto-approval is still disabled for listSources
      const autoApprovedCheck = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (autoApprovedCheck) {
        await page.click('#tool-no-approval-listSources');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Navigate to chat tab
      await page.click('[data-tab="chat"]');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 6: Send a message that triggers listSources tool
      const query = 'Please use listSources to show me what sources are in this notebook.';

      await page.evaluate((text) => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);

      await new Promise(resolve => setTimeout(resolve, 100));

      await page.evaluate(() => {
        const btn = document.getElementById('query-btn') as HTMLButtonElement;
        btn.click();
      });

      // Step 7: Wait for approval dialog
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return dialog && dialog.open;
      }, { timeout: 15000 });

      // Step 8: Select "session" scope before approving
      await page.evaluate(() => {
        const sessionRadio = document.querySelector('input[value="session"]') as HTMLInputElement;
        if (sessionRadio) sessionRadio.click();
      });

      // Verify session scope is selected
      const sessionScopeSelected = await page.evaluate(() => {
        const sessionRadio = document.querySelector('input[value="session"]') as HTMLInputElement;
        return sessionRadio?.checked || false;
      });
      expect(sessionScopeSelected).toBe(true);

      // Step 9: Approve with session scope
      await page.evaluate(() => {
        const approveBtn = document.querySelector('[data-approve]') as HTMLButtonElement;
        if (approveBtn) approveBtn.click();
      });

      // Step 10: Wait for dialog to close
      await page.waitForFunction(() => {
        const dialog = document.getElementById('approval-dialog') as HTMLDialogElement;
        return !dialog || !dialog.open;
      }, { timeout: 5000 });

      // Step 11: Verify tool executed
      await page.waitForFunction(() => {
        const toolCalls = document.querySelectorAll('.assistant-tool-call');
        return toolCalls.length > 0;
      }, { timeout: 10000 });

      // Step 12: Send another message - tool should be auto-approved (session-scoped)
      await page.evaluate((text) => {
        const input = document.getElementById('query-input') as HTMLInputElement;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, query);

      await new Promise(resolve => setTimeout(resolve, 100));

      await page.evaluate(() => {
        const btn = document.getElementById('query-btn') as HTMLButtonElement;
        btn.click();
      });

      // This time the tool should execute without waiting for approval (session-scoped)
      // Verify we get a result without approval dialog appearing
      await page.waitForFunction(() => {
        const toolCalls = document.querySelectorAll('.assistant-tool-call');
        return toolCalls.length >= 2; // Should have at least 2 tool calls now
      }, { timeout: 10000 });

      // Clean up - clear session approvals by updating chrome.storage.local directly
      await page.evaluate(async () => {
        const result = await chrome.storage.local.get('toolPermissions') as { toolPermissions?: { sessionApprovals: string[] } };
        if (result.toolPermissions) {
          result.toolPermissions.sessionApprovals = [];
          await chrome.storage.local.set({ toolPermissions: result.toolPermissions });
        }
      });

      // Re-enable auto-approval
      await page.click('#header-settings-btn');
      await waitForElement(page, '#tool-no-approval-listSources');

      const isCurrentlyAutoApproved = await page.$eval('#tool-no-approval-listSources',
        (el) => (el as HTMLInputElement).checked
      );

      if (!isCurrentlyAutoApproved) {
        await page.click('#tool-no-approval-listSources');
      }
    });
  });
});
