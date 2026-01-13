import type { VNode } from './jsx-runtime/vnode'
import { jsx, Fragment } from './jsx-runtime'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: {
        className?: string
        [attr: string]: unknown
      }
    }

    // JSX expressions now return VNode, not Node
    // This enables the VNode-based reconciler with hooks support
    type Element = VNode
    interface ElementChildrenAttribute {
      children: unknown
    }
  }
}

export { jsx, Fragment }
