/**
 * 用户偏好
 */

import { type Ref } from 'vue'
import { useDB } from './useDB'
import { STORAGE_KEYS } from '@/constants'
import { DEFAULT_PREFERENCES, DEFAULT_IDLE_TEXTS, PREFS_VERSION, type UserPreferences } from '@/types/settings'

let _prefs: Ref<UserPreferences> | undefined

function getPrefs() {
  if (!_prefs) {
    _prefs = useDB<UserPreferences>(STORAGE_KEYS.PREFS, { ...DEFAULT_PREFERENCES })
  }
  return _prefs
}

/** v2 及以前的档位速度 → v3 的数值速率 */
const LEGACY_SPEED: Record<string, number> = {
  off: 1,
  fast: 1.6,
  normal: 1,
  slow: 0.6,
}

/**
 * IndexedDB 异步载入完成后调用：补齐缺省字段 + 一次性迁移。
 * 载入前 getPrefs() 拿到的只是默认值，此函数保证真实数据也经过同样处理。
 */
export function normalizePrefs(): void {
  const prefs = getPrefs()
  const raw = prefs.value as UserPreferences & { animationSpeed?: string }
  const merged: UserPreferences = { ...DEFAULT_PREFERENCES, ...raw }

  if (typeof merged.scrollSpeed !== 'number' || !Number.isFinite(merged.scrollSpeed)) {
    merged.scrollSpeed = LEGACY_SPEED[raw.animationSpeed ?? ''] ?? 1
  }
  merged.scrollSpeed = Math.min(3, Math.max(0.1, merged.scrollSpeed))

  // 旧字段不再使用，落库前剔除
  delete (merged as UserPreferences & { animationSpeed?: string }).animationSpeed

  // 空结果文案：旧数据没有这个字段，或用户全删了，都回落到默认
  if (!Array.isArray(merged.idleTexts) || merged.idleTexts.length === 0) {
    merged.idleTexts = [...DEFAULT_IDLE_TEXTS]
  }

  merged.prefsVersion = PREFS_VERSION
  prefs.value = merged
}

export function useSettings() {
  const prefs = getPrefs()

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    prefs.value[key] = value
  }

  function reset() {
    prefs.value = { ...DEFAULT_PREFERENCES, idleTexts: [...DEFAULT_IDLE_TEXTS] }
  }

  return { prefs, update, reset }
}
