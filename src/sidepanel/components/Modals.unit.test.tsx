import { render, fireEvent } from '@testing-library/preact'
import { describe, it, expect, vi } from 'vitest'
import { PickerModal, ImagePickerModal } from './Modals'

describe('Modals keyboard interaction', () => {
  it('toggles picker items on Enter', () => {
    const onToggleItem = vi.fn()

    const { getByRole } = render(
      <PickerModal
        isOpen
        title="Select Tabs"
        items={[{
          id: 'tab-1',
          title: 'Example Tab',
          url: 'https://example.com',
          selected: false,
        }]}
        isLoading={false}
        searchQuery=""
        selectedCount={0}
        onClose={vi.fn()}
        onSearchChange={vi.fn()}
        onToggleItem={onToggleItem}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onAddSelected={vi.fn()}
      />,
    )

    const item = getByRole('checkbox', { name: 'Example Tab' })
    fireEvent.keyDown(item, { key: 'Enter' })

    expect(onToggleItem).toHaveBeenCalledWith('tab-1')
  })

  it('toggles image items on Space', () => {
    const onToggleImage = vi.fn()

    const { getByRole } = render(
      <ImagePickerModal
        isOpen
        images={[{
          src: 'https://example.com/image.png',
          alt: 'Example Image',
          width: 200,
          height: 200,
          selected: false,
        }]}
        isLoading={false}
        selectedCount={0}
        onClose={vi.fn()}
        onToggleImage={onToggleImage}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onAddSelected={vi.fn()}
      />,
    )

    const imageItem = getByRole('checkbox', { name: 'Example Image' })
    fireEvent.keyDown(imageItem, { key: ' ' })

    expect(onToggleImage).toHaveBeenCalledWith('https://example.com/image.png')
  })
})
