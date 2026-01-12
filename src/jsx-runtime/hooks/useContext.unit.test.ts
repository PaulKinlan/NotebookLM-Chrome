/**
 * Tests for useContext hook
 */

import { describe, it, expect } from 'vitest'
import { textVNode, componentVNode } from '../test/setup.ts'

describe('useContext', () => {
  it('should provide and consume context values', async () => {
    const { createContext, useContext } = await import('./index.ts')
    const { render } = await import('../render.ts')
    const { ContextProvider } = await import('./useContext.ts')

    const ThemeContext = createContext({ mode: 'light' })
    let consumedTheme: { mode: string } | null = null

    function Consumer() {
      const theme = useContext(ThemeContext)
      consumedTheme = theme
      return textVNode(`Theme: ${theme.mode}`)
    }

    function App() {
      return ContextProvider({
        context: ThemeContext,
        value: { mode: 'dark' },
        children: [textVNode('wrapper'), componentVNode(Consumer)],
      })
    }

    const container = globalThis.document.getElementById('app')!
    await render(componentVNode(App), container)

    expect(consumedTheme).toEqual({ mode: 'dark' })
  })
})
