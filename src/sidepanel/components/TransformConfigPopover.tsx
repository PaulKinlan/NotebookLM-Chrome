/**
 * TransformConfigPopover - Configuration dialog for transform options
 *
 * Provides a popover UI for users to customize transformation settings
 * before generating content. Uses the native HTML dialog element.
 */

import { useRef, useEffect, useState, useCallback } from 'preact/hooks'
import type { TransformationType, TransformConfigMap } from '../../types/index.ts'
import {
  getTransformConfig,
  saveTransformConfig,
  resetTransformConfig,
  CONFIG_LABELS,
  PROMPT_INFO,
  DEFAULT_CONFIGS,
} from '../../lib/transform-config.ts'

interface TransformConfigPopoverProps {
  type: TransformationType
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

type FieldConfig = {
  label: string
  type: 'number' | 'text' | 'checkbox' | 'select' | 'multiselect'
  min?: number
  max?: number
  placeholder?: string
  options?: Array<{ value: string | number, label: string }>
}

export function TransformConfigPopover(props: TransformConfigPopoverProps) {
  const { type, isOpen, onClose, onSave } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [config, setConfig] = useState<TransformConfigMap[typeof type] | null>(null)
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false)

  const labelConfig = CONFIG_LABELS[type]
  const promptInfo = PROMPT_INFO[type]

  // Load config when dialog opens
  useEffect(() => {
    if (isOpen) {
      void getTransformConfig(type).then(setConfig)
    }
  }, [isOpen, type])

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    }
    else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  // Handle close event from dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => {
      onClose()
    }

    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Handle click outside dialog to close
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      const dialog = dialogRef.current
      if (dialog && e.target === dialog) {
        dialog.close()
      }
    },
    [],
  )

  const handleFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      setConfig((prev) => {
        if (!prev) return prev
        return { ...prev, [fieldKey]: value }
      })
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!config) return

    await saveTransformConfig(type, config)
    setShowSaveConfirmation(true)

    setTimeout(() => {
      setShowSaveConfirmation(false)
    }, 1500)

    onSave?.()
    onClose()
  }, [config, type, onSave, onClose])

  const handleReset = useCallback(async () => {
    const defaultConfig = await resetTransformConfig(type)
    setConfig(defaultConfig)
  }, [type])

  const renderField = (fieldKey: string, fieldConfig: FieldConfig, currentValue: unknown) => {
    const fieldId = `config-${type}-${fieldKey}`

    switch (fieldConfig.type) {
      case 'number':
        return (
          <div className="config-field" key={fieldKey}>
            <label htmlFor={fieldId}>{fieldConfig.label}</label>
            <input
              type="number"
              id={fieldId}
              value={currentValue as number}
              min={fieldConfig.min}
              max={fieldConfig.max}
              onChange={e => handleFieldChange(fieldKey, parseInt((e.target as HTMLInputElement).value, 10))}
            />
          </div>
        )

      case 'text':
        return (
          <div className="config-field" key={fieldKey}>
            <label htmlFor={fieldId}>{fieldConfig.label}</label>
            <input
              type="text"
              id={fieldId}
              value={(currentValue as string) || ''}
              placeholder={fieldConfig.placeholder}
              onChange={e => handleFieldChange(fieldKey, (e.target as HTMLInputElement).value)}
            />
          </div>
        )

      case 'checkbox':
        return (
          <div className="config-field" key={fieldKey}>
            <div className="checkbox-container">
              <input
                type="checkbox"
                id={fieldId}
                checked={currentValue as boolean}
                onChange={e => handleFieldChange(fieldKey, (e.target as HTMLInputElement).checked)}
              />
              <label htmlFor={fieldId}>{fieldConfig.label}</label>
            </div>
          </div>
        )

      case 'select':
        return (
          <div className="config-field" key={fieldKey}>
            <label htmlFor={fieldId}>{fieldConfig.label}</label>
            <select
              id={fieldId}
              value={currentValue as string | number}
              onChange={(e) => {
                const selectValue = (e.target as HTMLSelectElement).value
                // Check if we need to convert to number
                const option = fieldConfig.options?.find(
                  opt => String(opt.value) === selectValue,
                )
                if (option && typeof option.value === 'number') {
                  handleFieldChange(fieldKey, parseInt(selectValue, 10))
                }
                else {
                  handleFieldChange(fieldKey, selectValue)
                }
              }}
            >
              {fieldConfig.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'multiselect':
        return (
          <div className="config-field" key={fieldKey}>
            <label>{fieldConfig.label}</label>
            <div className="multiselect-container">
              {fieldConfig.options?.map((opt) => {
                const isChecked = Array.isArray(currentValue) && currentValue.includes(opt.value)
                const itemId = `${fieldId}-${opt.value}`
                return (
                  <div className="multiselect-item" key={opt.value}>
                    <input
                      type="checkbox"
                      id={itemId}
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked
                        const currentArray = (Array.isArray(currentValue) ? currentValue : []) as (string | number)[]
                        if (checked) {
                          handleFieldChange(fieldKey, [...currentArray, opt.value])
                        }
                        else {
                          handleFieldChange(
                            fieldKey,
                            currentArray.filter(v => v !== opt.value),
                          )
                        }
                      }}
                    />
                    <label htmlFor={itemId}>{opt.label}</label>
                  </div>
                )
              })}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const fields = labelConfig.fields as Record<string, FieldConfig>
  const defaults = DEFAULT_CONFIGS[type] as unknown as Record<string, unknown>

  return (
    <dialog
      ref={dialogRef}
      className="transform-config-popover"
      onClick={handleBackdropClick}
    >
      <div className="config-popover-header">
        <h3>{labelConfig.title}</h3>
      </div>

      {!config
        ? (
            <div className="config-popover-loading">Loading...</div>
          )
        : (
            <>
              <form className="config-popover-form" onSubmit={e => e.preventDefault()}>
                {Object.entries(fields).map(([fieldKey, fieldConfig]) => {
                  // Skip customInstructions - we render it separately at the bottom
                  if (fieldKey === 'customInstructions') return null
                  const currentValue = (config as unknown as Record<string, unknown>)[fieldKey] ?? defaults[fieldKey]
                  return renderField(fieldKey, fieldConfig, currentValue)
                })}

                {/* Custom Instructions - always at the bottom */}
                <div className="config-field config-field-full">
                  <label htmlFor={`config-${type}-customInstructions`}>Custom Instructions</label>
                  <textarea
                    id={`config-${type}-customInstructions`}
                    value={(config as unknown as Record<string, unknown>).customInstructions as string || ''}
                    placeholder="Add any specific instructions to customize the output..."
                    onChange={e =>
                      handleFieldChange('customInstructions', (e.target as HTMLTextAreaElement).value)}
                  />
                </div>
              </form>

              {/* Advanced: Prompt Information */}
              <details className="config-advanced-section">
                <summary>Advanced: How this prompt works</summary>
                <div className="config-advanced-content">
                  <p className="config-advanced-desc">{promptInfo.description}</p>
                  <span className="config-advanced-label">Prompt Structure</span>
                  <p className="config-advanced-structure">{promptInfo.structure}</p>
                </div>
              </details>

              <div className="config-popover-footer">
                <button type="button" className="btn-secondary" onClick={() => void handleReset()}>
                  Reset to Defaults
                </button>
                <button type="button" className="btn-primary" onClick={() => void handleSave()}>
                  {showSaveConfirmation ? 'Saved!' : 'Save'}
                </button>
              </div>
            </>
          )}
    </dialog>
  )
}

// Cog/Settings icon for config button
export function ConfigIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  )
}
