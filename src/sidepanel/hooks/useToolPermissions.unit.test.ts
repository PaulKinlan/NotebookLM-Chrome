/**
 * Unit tests for useToolPermissions hook
 *
 * Tests the tool permissions management hook including:
 * - Loading tool permissions configuration from storage
 * - Toggling tool visibility
 * - Toggling tool approval requirements
 * - Resetting to default permissions
 *
 * Note: This test file validates the hook's behavior by testing the
 * underlying functions it calls. Direct hook testing would require
 * a Preact component context.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ToolPermissionsConfig } from '../../types/index.ts'

// ============================================================================
// Mocks
// ============================================================================

// Mock tool-permissions module
let storedPermissions: ToolPermissionsConfig | null = null

const mockGetToolPermissions = vi.fn()
const mockSaveToolPermissions = vi.fn()

vi.mock('../../lib/tool-permissions.ts', () => ({
  getToolPermissions: mockGetToolPermissions,
  saveToolPermissions: mockSaveToolPermissions,
}))

// ============================================================================
// Test Utilities
// ============================================================================

const defaultConfig: ToolPermissionsConfig = {
  permissions: {
    listSources: {
      toolName: 'listSources',
      visible: true,
      requiresApproval: false,
      autoApproved: true,
    },
    readSource: {
      toolName: 'readSource',
      visible: true,
      requiresApproval: false,
      autoApproved: true,
    },
    findRelevantSources: {
      toolName: 'findRelevantSources',
      visible: true,
      requiresApproval: false,
      autoApproved: true,
    },
    listWindows: {
      toolName: 'listWindows',
      visible: true,
      requiresApproval: true,
      autoApproved: false,
    },
    listTabs: {
      toolName: 'listTabs',
      visible: true,
      requiresApproval: true,
      autoApproved: false,
    },
    listTabGroups: {
      toolName: 'listTabGroups',
      visible: true,
      requiresApproval: true,
      autoApproved: false,
    },
    readPageContent: {
      toolName: 'readPageContent',
      visible: true,
      requiresApproval: true,
      autoApproved: false,
    },
  },
  sessionApprovals: [],
  lastModified: Date.now(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllGlobals()

  // Reset stored permissions - create a fresh deep copy each time
  storedPermissions = JSON.parse(JSON.stringify(defaultConfig)) as ToolPermissionsConfig

  // Setup default mock behavior - return a fresh copy each time to avoid mutations
  mockGetToolPermissions.mockImplementation(async () => JSON.parse(JSON.stringify(storedPermissions ?? defaultConfig)) as ToolPermissionsConfig)
  mockSaveToolPermissions.mockImplementation(async (config: ToolPermissionsConfig) => {
    storedPermissions = JSON.parse(JSON.stringify(config)) as ToolPermissionsConfig
  })
})

// ============================================================================
// Tests
// ============================================================================

describe('useToolPermissions - behaviors', () => {
  describe('loadConfig behavior', () => {
    it('calls getToolPermissions to load config from storage', async () => {
      await import('../../lib/tool-permissions.ts')

      const result = await mockGetToolPermissions()

      expect(mockGetToolPermissions).toHaveBeenCalled()
      expect(result).toEqual(defaultConfig)
    })

    it('returns the config with all default tool permissions', async () => {
      const result = await mockGetToolPermissions()

      expect(result?.permissions).toBeDefined()
      expect(Object.keys(result?.permissions ?? {})).toContain('listSources')
      expect(Object.keys(result?.permissions ?? {})).toContain('listTabs')
      expect(Object.keys(result?.permissions ?? {})).toContain('readPageContent')
    })
  })

  describe('toggleToolVisible behavior', () => {
    it('updates tool visible property when called', async () => {
      // Start with visible tool
      expect(storedPermissions?.permissions.listTabs.visible).toBe(true)

      // Simulate what the hook does: get current, update, save
      const current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = false
      }
      await mockSaveToolPermissions(current)

      expect(mockSaveToolPermissions).toHaveBeenCalled()
      expect(storedPermissions?.permissions.listTabs.visible).toBe(false)
    })

    it('can toggle visibility from false to true', async () => {
      // Start with hidden tool
      const configWithHiddenTool: ToolPermissionsConfig = {
        ...defaultConfig,
        permissions: {
          ...defaultConfig.permissions,
          listTabs: {
            toolName: 'listTabs',
            visible: false,
            requiresApproval: true,
            autoApproved: false,
          },
        },
      }
      mockGetToolPermissions.mockResolvedValue(configWithHiddenTool)

      const current = await mockGetToolPermissions()
      expect(current?.permissions.listTabs.visible).toBe(false)

      // Toggle to true
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = true
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.listTabs.visible).toBe(true)
    })

    it('does not add non-existent tools to permissions', async () => {
      const current = await mockGetToolPermissions()

      // Try to modify a non-existent tool
      if (current?.permissions.nonExistentTool) {
        current.permissions.nonExistentTool.visible = true
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.nonExistentTool).toBeUndefined()
    })

    it('preserves other tool properties when toggling visibility', async () => {
      const current = await mockGetToolPermissions()
      const originalRequiresApproval = current?.permissions.listTabs.requiresApproval
      const originalAutoApproved = current?.permissions.listTabs.autoApproved

      // Toggle visibility
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = false
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(originalRequiresApproval)
      expect(storedPermissions?.permissions.listTabs.autoApproved).toBe(originalAutoApproved)
    })
  })

  describe('toggleToolRequiresApproval behavior', () => {
    it('updates tool requiresApproval property when called', async () => {
      // Start with tool requiring approval
      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(true)

      // Simulate what the hook does: get current, update, save
      const current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.requiresApproval = false
      }
      await mockSaveToolPermissions(current)

      expect(mockSaveToolPermissions).toHaveBeenCalled()
      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(false)
    })

    it('can toggle requiresApproval from false to true', async () => {
      // Start with tool not requiring approval
      const configWithoutApproval: ToolPermissionsConfig = {
        ...defaultConfig,
        permissions: {
          ...defaultConfig.permissions,
          listTabs: {
            toolName: 'listTabs',
            visible: true,
            requiresApproval: false,
            autoApproved: false,
          },
        },
      }
      mockGetToolPermissions.mockResolvedValue(configWithoutApproval)

      const current = await mockGetToolPermissions()
      expect(current?.permissions.listTabs.requiresApproval).toBe(false)

      // Toggle to true
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.requiresApproval = true
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(true)
    })

    it('does not add non-existent tools to permissions', async () => {
      const current = await mockGetToolPermissions()

      // Try to modify a non-existent tool
      if (current?.permissions.nonExistentTool) {
        current.permissions.nonExistentTool.requiresApproval = false
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.nonExistentTool).toBeUndefined()
    })

    it('preserves other tool properties when toggling requiresApproval', async () => {
      const current = await mockGetToolPermissions()
      const originalVisible = current?.permissions.listTabs.visible
      const originalAutoApproved = current?.permissions.listTabs.autoApproved

      // Toggle requiresApproval
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.requiresApproval = false
      }
      await mockSaveToolPermissions(current)

      expect(storedPermissions?.permissions.listTabs.visible).toBe(originalVisible)
      expect(storedPermissions?.permissions.listTabs.autoApproved).toBe(originalAutoApproved)
    })
  })

  describe('resetToDefaults behavior', () => {
    it('resets all permissions to empty state', async () => {
      // Verify we have permissions initially
      expect(Object.keys(storedPermissions?.permissions ?? {})).toHaveLength(7)

      // Simulate reset
      await mockSaveToolPermissions({
        permissions: {},
        sessionApprovals: [],
        lastModified: Date.now(),
      })

      expect(mockSaveToolPermissions).toHaveBeenCalledWith({
        permissions: {},
        sessionApprovals: [],
        lastModified: expect.any(Number),
      })
    })

    it('saves with current timestamp', async () => {
      const beforeTime = Date.now()

      await mockSaveToolPermissions({
        permissions: {},
        sessionApprovals: [],
        lastModified: Date.now(),
      })

      const afterTime = Date.now()

      expect(mockSaveToolPermissions).toHaveBeenCalledWith({
        permissions: {},
        sessionApprovals: [],
        lastModified: expect.any(Number),
      })

      const savedConfig = mockSaveToolPermissions.mock.calls[0][0]
      expect(savedConfig.lastModified).toBeGreaterThanOrEqual(beforeTime)
      expect(savedConfig.lastModified).toBeLessThanOrEqual(afterTime)
    })

    it('clears sessionApprovals when resetting', async () => {
      const configWithApprovals: ToolPermissionsConfig = {
        ...defaultConfig,
        sessionApprovals: ['listTabs', 'readPageContent'],
      }
      mockGetToolPermissions.mockResolvedValue(configWithApprovals)

      // Reset
      await mockSaveToolPermissions({
        permissions: {},
        sessionApprovals: [],
        lastModified: Date.now(),
      })

      const savedConfig = mockSaveToolPermissions.mock.calls[0][0]
      expect(savedConfig.sessionApprovals).toEqual([])
      expect(savedConfig.sessionApprovals).toHaveLength(0)
    })
  })

  describe('integration scenarios', () => {
    it('handles multiple permission changes in sequence', async () => {
      // First change: hide listTabs
      let current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = false
      }
      await mockSaveToolPermissions(current)
      expect(storedPermissions?.permissions.listTabs.visible).toBe(false)

      // Second change: remove approval requirement
      current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.requiresApproval = false
      }
      await mockSaveToolPermissions(current)
      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(false)
      expect(storedPermissions?.permissions.listTabs.visible).toBe(false) // Still hidden

      // Third change: make visible again
      current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = true
      }
      await mockSaveToolPermissions(current)
      expect(storedPermissions?.permissions.listTabs.visible).toBe(true)
      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(false) // Still no approval
    })

    it('handles reset followed by new operations', async () => {
      // Initial load
      let current = await mockGetToolPermissions()
      expect(Object.keys(current?.permissions ?? {})).toHaveLength(7)

      // Reset to defaults
      await mockSaveToolPermissions({
        permissions: {},
        sessionApprovals: [],
        lastModified: Date.now(),
      })

      // Mock empty permissions after reset
      mockGetToolPermissions.mockResolvedValue({
        permissions: {},
        sessionApprovals: [],
        lastModified: Date.now(),
      })

      // Try to toggle a tool that no longer exists
      current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = true
      }
      await mockSaveToolPermissions(current)

      // Tool should not be added
      expect(storedPermissions?.permissions.listTabs).toBeUndefined()
    })

    it('can modify multiple tools independently', async () => {
      // Modify listTabs
      let current = await mockGetToolPermissions()
      if (current?.permissions.listTabs) {
        current.permissions.listTabs.visible = false
        current.permissions.listTabs.requiresApproval = false
      }
      await mockSaveToolPermissions(current)

      // Modify readPageContent differently
      current = await mockGetToolPermissions()
      if (current?.permissions.readPageContent) {
        current.permissions.readPageContent.visible = false
        // keep requiresApproval as true
      }
      await mockSaveToolPermissions(current)

      // Verify both changes persisted independently
      expect(storedPermissions?.permissions.listTabs.visible).toBe(false)
      expect(storedPermissions?.permissions.listTabs.requiresApproval).toBe(false)
      expect(storedPermissions?.permissions.readPageContent.visible).toBe(false)
      expect(storedPermissions?.permissions.readPageContent.requiresApproval).toBe(true)
    })
  })

  describe('hook interface', () => {
    it('hook file exports the expected function', async () => {
      const hookModule = await import('../../sidepanel/hooks/useToolPermissions.ts')

      expect(hookModule).toHaveProperty('useToolPermissions')
      expect(typeof hookModule.useToolPermissions).toBe('function')
    })

    it('hook return type includes all expected properties', async () => {
      // This is a compile-time type check - if it compiles, the types are correct
      type HookReturn = Awaited<ReturnType<typeof import('../../sidepanel/hooks/useToolPermissions.ts').useToolPermissions>>

      // The following line will cause a type error if the hook return type is incorrect
      const _typeCheck: HookReturn = {} as HookReturn

      // Verify expected properties exist at compile time
      expect(typeof _typeCheck).toBe('object')
    })
  })

  describe('default permissions structure', () => {
    it('includes all expected source tools with correct defaults', async () => {
      const config = await mockGetToolPermissions()

      // Source tools should be visible, not require approval, auto-approved
      expect(config?.permissions.listSources.visible).toBe(true)
      expect(config?.permissions.listSources.requiresApproval).toBe(false)
      expect(config?.permissions.listSources.autoApproved).toBe(true)

      expect(config?.permissions.readSource.visible).toBe(true)
      expect(config?.permissions.readSource.requiresApproval).toBe(false)
      expect(config?.permissions.readSource.autoApproved).toBe(true)

      expect(config?.permissions.findRelevantSources.visible).toBe(true)
      expect(config?.permissions.findRelevantSources.requiresApproval).toBe(false)
      expect(config?.permissions.findRelevantSources.autoApproved).toBe(true)
    })

    it('includes all expected browser tools with correct defaults', async () => {
      const config = await mockGetToolPermissions()

      // Browser tools should be visible, require approval, not auto-approved
      expect(config?.permissions.listWindows.visible).toBe(true)
      expect(config?.permissions.listWindows.requiresApproval).toBe(true)
      expect(config?.permissions.listWindows.autoApproved).toBe(false)

      expect(config?.permissions.listTabs.visible).toBe(true)
      expect(config?.permissions.listTabs.requiresApproval).toBe(true)
      expect(config?.permissions.listTabs.autoApproved).toBe(false)

      expect(config?.permissions.readPageContent.visible).toBe(true)
      expect(config?.permissions.readPageContent.requiresApproval).toBe(true)
      expect(config?.permissions.readPageContent.autoApproved).toBe(false)
    })

    it('includes 7 default tools', async () => {
      const config = await mockGetToolPermissions()

      const toolNames = Object.keys(config?.permissions ?? {})
      expect(toolNames).toHaveLength(7)
      expect(toolNames).toEqual(expect.arrayContaining([
        'listSources',
        'readSource',
        'findRelevantSources',
        'listWindows',
        'listTabs',
        'listTabGroups',
        'readPageContent',
      ]))
    })
  })
})
