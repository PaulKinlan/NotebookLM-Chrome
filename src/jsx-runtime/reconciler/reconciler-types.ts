/**
 * Reconciler - Shared Types
 */

import type { VNode } from '../vnode.ts'
import type { ComponentInstance } from '../component.ts'

/**
 * Reconciler function signature
 * All functions that need to recursively reconcile accept this as a parameter
 */
export type ReconcilerFn = (
  parent: Node,
  oldVNode: VNode | null,
  newVNode: VNode,
  component?: ComponentInstance,
  svgNamespace?: string,
) => Promise<Node>

/**
 * Mount operations
 */
export type MountFn = (
  parent: Node,
  vnode: VNode,
  component?: ComponentInstance,
  reconcile?: ReconcilerFn,
  svgNamespace?: string,
) => Promise<Node>

export type MountElementFn = (
  parent: Node,
  vnode: Extract<VNode, { type: 'element' }>,
  reconcile: ReconcilerFn,
  svgNamespace?: string,
) => Element

export type MountComponentFn = (
  parent: Node,
  vnode: Extract<VNode, { type: 'component' }>,
  parentComponent?: ComponentInstance,
  reconcile?: ReconcilerFn,
  svgNamespace?: string,
) => Promise<Node>

export type MountFragmentFn = (
  parent: Node,
  vnode: Extract<VNode, { type: 'fragment' }>,
  component?: ComponentInstance,
  reconcile?: ReconcilerFn,
  svgNamespace?: string,
) => Node

/**
 * Update operations
 */
export type UpdateElementFn = (
  parent: Element,
  oldVNode: Extract<VNode, { type: 'element' }>,
  newVNode: Extract<VNode, { type: 'element' }>,
  reconcile: ReconcilerFn,
  svgNamespace?: string,
) => Promise<Node>

export type UpdateComponentFn = (
  parent: Node,
  oldVNode: Extract<VNode, { type: 'component' }>,
  newVNode: Extract<VNode, { type: 'component' }>,
  reconcile: ReconcilerFn,
) => Promise<Node>

export type UpdateFragmentFn = (
  parent: Node,
  oldVNode: Extract<VNode, { type: 'fragment' }>,
  newVNode: Extract<VNode, { type: 'fragment' }>,
  component?: ComponentInstance,
  reconcile?: ReconcilerFn,
) => Promise<Node>
