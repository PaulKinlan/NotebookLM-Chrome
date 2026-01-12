/**
 * useId Hook
 *
 * Generates stable unique IDs for accessibility features like label/input associations.
 * IDs are stable across re-renders and unique per component instance.
 */

import { getCurrentComponent } from '../component.ts'

/**
 * Global counter for generating unique IDs across components
 */
let globalIdCounter = 0

/**
 * Map to track component-specific ID counters
 */
const componentIdCounters = new WeakMap<object, number>()

/**
 * useId hook - generates a stable unique ID
 *
 * The ID is generated once on first render and remains stable across re-renders.
 * If you call useId multiple times in the same component, each call returns a unique ID.
 *
 * @returns A unique string ID
 *
 * @example
 * ```tsx
 * function FormField() {
 *   const id = useId()
 *   return (
 *     <>
 *       <label htmlFor={id}>Email</label>
 *       <input id={id} type="email" />
 *     </>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Multiple IDs in same component
 * function NameFields() {
 *   const firstNameId = useId()
 *   const lastNameId = useId()
 *   return (
 *     <>
 *   <label htmlFor={firstNameId}>First Name</label>
 *   <input id={firstNameId} />
 *   <label htmlFor={lastNameId}>Last Name</label>
 *   <input id={lastNameId} />
 *     </>
 *   )
 * }
 * ```
 */
export function useId(): string {
  const component = getCurrentComponent()
  if (!component) {
    // Called outside component - return a globally unique ID
    return `:id-${globalIdCounter++}`
  }

  const index = component.hookIndex++

  // Initialize hook if first render
  if (index >= component.hooks.length) {
    // Get or initialize the counter for this component
    let counter = componentIdCounters.get(component)
    if (counter === undefined) {
      counter = 0
      componentIdCounters.set(component, counter)
    }

    // Generate the ID
    const id = `:id${globalIdCounter++}-${counter++}`

    // Update the component's counter
    componentIdCounters.set(component, counter)

    component.hooks.push({
      type: 'id',
      value: id,
    })
  }

  const hook = component.hooks[index]
  return hook.value as string
}
