/**
 * 用户偏好
 */

import { type Ref } from 'vue'
import { useStorage } from './useStorage'
import { STORAGE_KEYS } from '@/constants'
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/types/settings'

let _prefs: Ref<UserPreferences> | undefined
function getPrefs() {
  if (!_prefs) {
    _prefs = useStorage<UserPreferences>(STORAGE_KEYS.PREFS, DEFAULT_PREFERENCES, 'local')
    _prefs.value = { ...DEFAULT_PREFERENCES, ..._prefs.value }
  }
  return _prefs
}

export function useSettings() {
  const prefs = getPrefs()

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    prefs.value[key] = value
  }

  function reset() {
    prefs.value = { ...DEFAULT_PREFERENCES }
  }

  return { prefs, update, reset }
}
