/**
 * Mask API key for display
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '••••••••'
  return apiKey.slice(0, 4) + '••••' + apiKey.slice(-4)
}
