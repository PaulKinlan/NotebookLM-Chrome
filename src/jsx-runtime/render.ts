/**
 * Main Render Function
 *
 * Entry point for rendering VNodes to the DOM.
 */

import type { VNode } from './vnode.ts'
import type { ComponentInstance } from './component.ts'
import { reconcile } from './reconciler.ts'
import { getUpdatePromise } from './scheduler.ts'

/**
 * Render a VNode into a container element
 *
 * This is the main entry point for rendering. It clears the container
 * and renders the VNode tree.
 *
 * @param vnode - The virtual node to render
 * @param container - The DOM element to render into
 * @returns A promise that resolves with the component instance (if any)
 *
 * @example
 * ```tsx
 * const app = (
 *   <div>
 *     <h1>Hello, world!</h1>
 *   </div>
 * )
 * render(app, document.getElementById('app'))
 * ```
 */
export async function render(
  vnode: VNode,
  container: Element | null,
): Promise<ComponentInstance | null> {
  if (!container) {
    console.warn('render: container is null')
    return null
  }

  // Clear existing content - remove children one by one to properly clean up components
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // Mount new VNode
  await reconcile(container, null, vnode)

  // Wait for any pending updates to complete
  await getUpdatePromise()

  // Return the component instance if the root was a component
  // For now, we don't track root component instances
  return null
}

/**
 * Render a VNode and return the DOM node
 * Utility function for testing
 *
 * @param vnode - The virtual node to render
 * @returns The rendered DOM node
 */
export async function renderToDOM(vnode: VNode): Promise<Node> {
  const container = document.createElement('div')
  await render(vnode, container)
  return container.firstChild!
}
