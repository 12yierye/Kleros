/**
 * 响应式 storage 封装
 * 支持 localStorage / sessionStorage
 * 跨标签页同步（localStorage 模式）
 */

import { ref, watch, type Ref } from 'vue'

export type StorageKind = 'local' | 'session'

function getStore(kind: StorageKind): Storage {
  return kind === 'local' ? window.localStorage : window.sessionStorage
}

export function useStorage<T>(
  key: string,
  defaultValue: T,
  kind: StorageKind = 'local'
): Ref<T> {
  const store = getStore(kind)
  const state = ref(load()) as Ref<T>

  function load(): T {
    try {
      const raw = store.getItem(key)
      if (raw === null) return clone(defaultValue)
      return JSON.parse(raw) as T
    } catch (e) {
      console.warn(`[useStorage] failed to parse ${key}`, e)
      return clone(defaultValue)
    }
  }

  function clone(v: T): T {
    if (v === null || v === undefined) return v
    if (typeof v !== 'object') return v
    return JSON.parse(JSON.stringify(v))
  }

  // 写回（深拷贝避免引用问题）
  watch(
    state,
    (val) => {
      try {
        store.setItem(key, JSON.stringify(val))
      } catch (e) {
        console.error(`[useStorage] failed to write ${key}`, e)
      }
    },
    { deep: true }
  )

  // 跨标签页同步（仅 local）
  if (kind === 'local') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key || e.newValue === null) return
      try {
        state.value = JSON.parse(e.newValue) as T
      } catch {
        /* noop */
      }
    })
  }

  return state
}
