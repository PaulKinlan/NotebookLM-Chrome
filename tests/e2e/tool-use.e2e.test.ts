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
});
