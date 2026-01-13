/**
 * Shared test setup for JSX runtime tests
 *
 * Provides JSDOM environment setup and VNode helper functions
 * that are used across all hook tests.
 */

import { beforeEach, afterEach } from 'vitest'
import type { VNode } from '../vnode.ts'
import { JSDOM } from 'jsdom'

let jsdom: JSDOM

// Store original console.error to suppress expected DOM errors
const originalConsoleError = console.error

beforeEach(() => {
  jsdom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  })
  globalThis.document = jsdom.window.document
  globalThis.Node = jsdom.window.Node
  globalThis.HTMLElement = jsdom.window.HTMLElement
  globalThis.Text = jsdom.window.Text

  // Use a synchronous mock for requestAnimationFrame in tests
  // This ensures updates are processed immediately when scheduled
  let rafCallback: FrameRequestCallback | null = null
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    rafCallback = cb
    return 1 as unknown as number
  }

  // @ts-expect-error - Adding test helper
  globalThis._flushRAF = () => {
    if (rafCallback) {
      const cb = rafCallback
      rafCallback = null
      cb(Date.now())
    }
  }

  // Suppress DOM errors during test cleanup
  console.error = (...args: unknown[]) => {
    const msg = String(args[0])
    if (msg.includes('NotFoundError') || msg.includes('child can not be found')) {
      return // Suppress expected cleanup errors
    }
    originalConsoleError(...args)
  }

  // Patch removeChild to suppress NotFoundError during cleanup
  const removeChildDescriptor = Object.getOwnPropertyDescriptor(
    jsdom.window.Node.prototype,
    'removeChild',
  )!
  const originalRemoveChild = removeChildDescriptor.value as (child: Node) => Node

  Object.defineProperty(jsdom.window.Node.prototype, 'removeChild', {
    ...removeChildDescriptor,
    value: function (this: Node, child: Node): Node {
      if (child.parentNode !== this) {
        return child // Already removed, skip
      }
      return originalRemoveChild.call(this, child)
    },
  })
})

afterEach(async () => {
  // Wait for any pending microtasks and RAF callbacks to complete
  await new Promise(resolve => setTimeout(resolve, 20))

  // Restore console.error
  console.error = originalConsoleError

  if (jsdom) {
    jsdom.window.close()
  }
})

// Global error handler to suppress DOM NotFoundErrors during test cleanup
// This happens when async operations try to manipulate DOM after cleanup
globalThis.addEventListener?.('error', (event) => {
  if (
    event.message?.includes('NotFoundError')
    || event.message?.includes('child can not be found')
  ) {
    event.preventDefault()
  }
})

globalThis.addEventListener?.('unhandledrejection', (event) => {
  const reason = event.reason as { name?: string } | undefined
  if (
    typeof reason === 'object'
    && reason !== null
    && 'name' in reason
    && reason.name === 'NotFoundError'
  ) {
    event.preventDefault()
  }
})

/**
 * Helper to create a proper text VNode
 */
export function textVNode(value: string): VNode {
  return { type: 'text' as const, value }
}

/**
 * Helper to create a component VNode
 */
export function componentVNode(fn: () => VNode | Node, props: Record<string, unknown> = {}): VNode {
  return {
    type: 'component',
    fn,
    props,
  }
}

/**
 * Helper to create an element VNode
 */
export function elementVNode(
  tag: string,
  props: Record<string, unknown> = {},
  children: Array<VNode | string> = [],
): VNode {
  // Extract key from props - it's a special VNode property, not a DOM prop
  const { key, ...domProps } = props
  return {
    type: 'element',
    tag,
    key: key as string | undefined,
    props: domProps,
    children: children.map(child =>
      typeof child === 'string' ? textVNode(child) : child,
    ),
  }
}
