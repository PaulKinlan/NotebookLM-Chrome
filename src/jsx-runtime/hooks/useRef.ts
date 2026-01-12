/**
 * useRef Hook
 *
 * Returns a mutable ref object that persists across renders.
 * The ref object has a single property `current` that can hold any value.
 *
 * Unlike useState, updating a ref's current value does not trigger a re-render.
 */

import { getCurrentComponent } from '../component.ts'
import type { ComponentInstance } from '../component.ts'

export interface RefObject<T> {
  current: T
}

const refRegistry = new WeakMap<ComponentInstance, Map<string, unknown>>()

/**
 * Get or create the ref map for a component instance
 */
function getRefMap(instance: ComponentInstance): Map<string, unknown> {
  let map = refRegistry.get(instance)
  if (!map) {
    map = new Map()
    refRegistry.set(instance, map)
  }
  return map
}

/**
 * useRef hook for creating a mutable ref object
 *
 * @param initialValue - The initial value for the ref
 * @returns A ref object with a mutable `current` property
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const countRef = useRef(0)
 *   const increment = () => {
 *     countRef.current++  // Does not trigger re-render
 *   }
 *   return <div>{countRef.current}</div>
 * }
 * ```
 */
export function useRef<T>(initialValue: T): RefObject<T> {
  const instance = getCurrentComponent()

  if (!instance) {
    // Called outside component - return a simple object
    return { current: initialValue }
  }

  const hookIndex = instance.hookIndex++
  const refKey = `ref-${hookIndex}`

  const refMap = getRefMap(instance)

  if (!refMap.has(refKey)) {
    // Initialize ref with the wrapper object
    const refObject: RefObject<T> = { current: initialValue }
    refMap.set(refKey, refObject)
  }

  return refMap.get(refKey) as RefObject<T>
}
