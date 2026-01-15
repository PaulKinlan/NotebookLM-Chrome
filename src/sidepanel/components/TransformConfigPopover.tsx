/**
 * Transform Configuration Popover Component
 *
 * Displays a popover with configuration options for each transformation type.
 * Uses the HTML Popover API for modern, accessible popup behavior.
 */

import type { TransformationType, TransformConfigMap } from '../../types/index.ts'
import { CONFIG_LABELS, PROMPT_INFO, getTransformConfig, saveTransformConfig, resetTransformConfig } from '../../lib/transform-config.ts'

/** Render a form field based on its type */
function renderField(
  fieldKey: string,
  fieldConfig: Record<string, unknown>,
  currentValue: unknown,
  onChange: (key: string, value: unknown) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'config-field'

  const label = document.createElement('label')
  label.textContent = fieldConfig.label as string
  label.htmlFor = `config-${fieldKey}`
  container.appendChild(label)

  const type = fieldConfig.type as string

  if (type === 'number') {
    const input = document.createElement('input')
    input.type = 'number'
    input.id = `config-${fieldKey}`
    input.value = typeof currentValue === 'number' ? String(currentValue) : ''
    input.min = typeof fieldConfig.min === 'number' ? String(fieldConfig.min) : '1'
    input.max = typeof fieldConfig.max === 'number' ? String(fieldConfig.max) : '100'
    input.addEventListener('change', () => {
      onChange(fieldKey, Number.parseInt(input.value, 10))
    })
    container.appendChild(input)
  }
  else if (type === 'text') {
    const input = document.createElement('input')
    input.type = 'text'
    input.id = `config-${fieldKey}`
    input.value = typeof currentValue === 'string' ? currentValue : ''
    if (fieldConfig.placeholder) {
      input.placeholder = fieldConfig.placeholder as string
    }
    input.addEventListener('change', () => {
      onChange(fieldKey, input.value)
    })
    container.appendChild(input)
  }
  else if (type === 'checkbox') {
    const checkContainer = document.createElement('div')
    checkContainer.className = 'checkbox-container'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.id = `config-${fieldKey}`
    input.checked = Boolean(currentValue)
    input.addEventListener('change', () => {
      onChange(fieldKey, input.checked)
    })
    checkContainer.appendChild(input)
    // Move label into checkbox container for inline display
    label.remove()
    const checkLabel = document.createElement('label')
    checkLabel.textContent = fieldConfig.label as string
    checkLabel.htmlFor = `config-${fieldKey}`
    checkContainer.appendChild(checkLabel)
    container.appendChild(checkContainer)
  }
  else if (type === 'select') {
    const select = document.createElement('select')
    select.id = `config-${fieldKey}`
    const options = fieldConfig.options as Array<{ value: string | number, label: string }>
    for (const opt of options) {
      const option = document.createElement('option')
      option.value = String(opt.value)
      option.textContent = opt.label
      if (String(opt.value) === String(currentValue)) {
        option.selected = true
      }
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      // Try to convert back to number if the original value was a number
      const numValue = Number.parseInt(select.value, 10)
      onChange(fieldKey, Number.isNaN(numValue) || String(numValue) !== select.value ? select.value : numValue)
    })
    container.appendChild(select)
  }
  else if (type === 'multiselect') {
    const multiContainer = document.createElement('div')
    multiContainer.className = 'multiselect-container'
    const options = fieldConfig.options as Array<{ value: string, label: string }>
    const currentArray: string[] = Array.isArray(currentValue)
      ? (currentValue as string[]).filter((v): v is string => typeof v === 'string')
      : []

    for (const opt of options) {
      const checkItem = document.createElement('div')
      checkItem.className = 'multiselect-item'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = `config-${fieldKey}-${opt.value}`
      checkbox.value = opt.value
      checkbox.checked = currentArray.includes(opt.value)
      checkbox.addEventListener('change', () => {
        const currentValues: string[] = [...currentArray]
        if (checkbox.checked) {
          if (!currentValues.includes(opt.value)) {
            currentValues.push(opt.value)
          }
        }
        else {
          const idx = currentValues.indexOf(opt.value)
          if (idx >= 0) {
            currentValues.splice(idx, 1)
          }
        }
        onChange(fieldKey, currentValues)
      })
      const optLabel = document.createElement('label')
      optLabel.htmlFor = checkbox.id
      optLabel.textContent = opt.label
      checkItem.appendChild(checkbox)
      checkItem.appendChild(optLabel)
      multiContainer.appendChild(checkItem)
    }
    container.appendChild(multiContainer)
  }

  return container
}

/**
 * Opens a configuration popover for a specific transformation type
 */
export async function openTransformConfigPopover(
  type: TransformationType,
  anchorButton: HTMLElement,
  notebookId: string,
): Promise<void> {
  // Check if popover already exists
  const existingPopover = document.getElementById(`config-popover-${type}`)
  if (existingPopover) {
    existingPopover.remove()
  }

  // Get current config for this notebook
  const currentConfig = await getTransformConfig(type, notebookId)
  const configLabels = CONFIG_LABELS[type]

  if (!configLabels) {
    console.warn(`No config labels found for transform type: ${type}`)
    return
  }

  // Create popover element
  const popover = document.createElement('div')
  popover.id = `config-popover-${type}`
  popover.className = 'transform-config-popover'
  popover.setAttribute('popover', 'auto')

  // Header
  const header = document.createElement('div')
  header.className = 'config-popover-header'
  const title = document.createElement('h3')
  title.textContent = configLabels.title
  header.appendChild(title)
  popover.appendChild(header)

  // Form content
  const form = document.createElement('form')
  form.className = 'config-popover-form'

  // Track current values
  const values: Record<string, unknown> = { ...currentConfig }

  // Render each field
  const fields = configLabels.fields as Record<string, Record<string, unknown>>
  for (const [key, fieldConfig] of Object.entries(fields)) {
    const field = renderField(
      key,
      fieldConfig,
      values[key],
      (k, v) => {
        values[k] = v
      },
    )
    form.appendChild(field)
  }

  // Custom instructions field (always present)
  const customInstructionsField = document.createElement('div')
  customInstructionsField.className = 'config-field config-field-full'
  const ciLabel = document.createElement('label')
  ciLabel.textContent = 'Custom Instructions'
  ciLabel.htmlFor = 'config-customInstructions'
  customInstructionsField.appendChild(ciLabel)

  const ciTextarea = document.createElement('textarea')
  ciTextarea.id = 'config-customInstructions'
  ciTextarea.placeholder = 'Add custom instructions to include in the AI prompt...'
  ciTextarea.value = typeof values.customInstructions === 'string' ? values.customInstructions : ''
  ciTextarea.rows = 3
  ciTextarea.addEventListener('input', () => {
    values.customInstructions = ciTextarea.value
  })
  customInstructionsField.appendChild(ciTextarea)
  form.appendChild(customInstructionsField)

  popover.appendChild(form)

  // Advanced info section (collapsible)
  const promptInfo = PROMPT_INFO[type]
  if (promptInfo) {
    const advancedSection = document.createElement('details')
    advancedSection.className = 'config-advanced-section'

    const summary = document.createElement('summary')
    summary.textContent = 'Advanced: How this prompt works'
    advancedSection.appendChild(summary)

    const infoContent = document.createElement('div')
    infoContent.className = 'config-advanced-content'

    const descPara = document.createElement('p')
    descPara.className = 'config-advanced-desc'
    descPara.textContent = promptInfo.description
    infoContent.appendChild(descPara)

    const structureLabel = document.createElement('span')
    structureLabel.className = 'config-advanced-label'
    structureLabel.textContent = 'Prompt Structure:'
    infoContent.appendChild(structureLabel)

    const structurePara = document.createElement('p')
    structurePara.className = 'config-advanced-structure'
    structurePara.textContent = promptInfo.structure
    infoContent.appendChild(structurePara)

    advancedSection.appendChild(infoContent)
    popover.appendChild(advancedSection)
  }

  // Footer with buttons
  const footer = document.createElement('div')
  footer.className = 'config-popover-footer'

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.className = 'btn-secondary'
  resetBtn.textContent = 'Reset to Defaults'
  resetBtn.addEventListener('click', () => {
    void resetTransformConfig(type, notebookId).then(() => {
      popover.hidePopover()
      // Re-open to show reset values
      setTimeout(() => void openTransformConfigPopover(type, anchorButton, notebookId), 100)
    })
  })

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'btn-primary'
  saveBtn.textContent = 'Save'
  saveBtn.addEventListener('click', () => {
    void saveTransformConfig(type, values as Partial<TransformConfigMap[typeof type]>, notebookId).then(() => {
      popover.hidePopover()
      // Show brief confirmation
      showSaveConfirmation(anchorButton)
    })
  })

  footer.appendChild(resetBtn)
  footer.appendChild(saveBtn)
  popover.appendChild(footer)

  // Add to document
  document.body.appendChild(popover)

  // Position and show popover
  popover.showPopover()
}

/**
 * Show a brief confirmation that settings were saved
 */
function showSaveConfirmation(anchor: HTMLElement) {
  const toast = document.createElement('div')
  toast.className = 'config-save-toast'
  toast.textContent = 'Settings saved'

  // Position near the anchor
  const rect = anchor.getBoundingClientRect()
  toast.style.position = 'fixed'
  toast.style.top = `${rect.top - 30}px`
  toast.style.left = `${rect.left}px`

  document.body.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('fade-out')
    setTimeout(() => toast.remove(), 300)
  }, 1500)
}

/**
 * Create a settings button for a transform card
 * @param type - The transformation type
 * @param getNotebookId - Function that returns the current notebook ID
 */
export function createConfigButton(
  type: TransformationType,
  getNotebookId: () => string | null,
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'transform-config-btn'
  btn.title = 'Configure settings'
  btn.setAttribute('aria-label', `Configure ${type} settings`)

  // Cog icon SVG
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  `

  btn.addEventListener('click', (e) => {
    e.stopPropagation() // Prevent triggering the transform
    const notebookId = getNotebookId()
    if (!notebookId) {
      console.warn('[TransformConfig] No notebook selected')
      return
    }
    void openTransformConfigPopover(type, btn, notebookId)
  })

  return btn
}

/**
 * Initialize config buttons for all transform cards
 * @param getNotebookId - Function that returns the current notebook ID
 */
export function initTransformConfigButtons(getNotebookId: () => string | null): void {
  const transformTypes: TransformationType[] = [
    'podcast',
    'quiz',
    'takeaways',
    'email',
    'slidedeck',
    'report',
    'datatable',
    'mindmap',
    'flashcards',
    'timeline',
    'glossary',
    'comparison',
    'faq',
    'actionitems',
    'executivebrief',
    'studyguide',
    'proscons',
    'citations',
    'outline',
  ]

  for (const type of transformTypes) {
    const card = document.getElementById(`transform-${type}`)
    if (card && !card.querySelector('.transform-config-btn')) {
      const configBtn = createConfigButton(type, getNotebookId)
      // Insert into the transform-icon div
      const iconDiv = card.querySelector('.transform-icon')
      if (iconDiv) {
        iconDiv.appendChild(configBtn)
      }
    }
  }
}
