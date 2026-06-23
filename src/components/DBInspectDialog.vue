<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { getDB } from '@/composables/useDB'
import { STORAGE_KEYS } from '@/constants'

const ui = useUi()
const isOpen = ref(false)
const loading = ref(false)
const error = ref('')
const copyMsg = ref('')
const data = ref<Record<string, { count: number; value: unknown }> | null>(null)
const dbMeta = ref<{ name: string; version: number; stores: string[] } | null>(null)

const STORE_LABELS: Record<string, string> = {
  [STORAGE_KEYS.ROSTER_TEMP]: '临时名单 (kleros.roster.temporary)',
  [STORAGE_KEYS.ROSTER_PERMANENT]: '常驻名单 (kleros.roster.permanent)',
  [STORAGE_KEYS.LISTS_BW]: '黑白名单 (kleros.lists.bw)',
  [STORAGE_KEYS.SESSION_CURRENT]: '当前会话 (kleros.session.current)',
  [STORAGE_KEYS.SESSION_HISTORY]: '历史会话 (kleros.session.history)',
  [STORAGE_KEYS.PREFS]: '用户偏好 (kleros.prefs)',
}
const ALL_STORES = Object.keys(STORE_LABELS)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const db = await getDB()
    dbMeta.value = {
      name: db.name,
      version: db.version,
      stores: Array.from(db.objectStoreNames),
    }
    const result: Record<string, { count: number; value: unknown }> = {}
    for (const name of ALL_STORES) {
      if (!db.objectStoreNames.contains(name)) {
        result[name] = { count: 0, value: '__NOT_FOUND__' }
        continue
      }
      const value = await readStore(db, name)
      result[name] = summarize(value)
    }
    data.value = result
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function readStore(db: IDBDatabase, name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readonly')
    const store = tx.objectStore(name)
    const req = store.get('value')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function summarize(value: unknown): { count: number; value: unknown } {
  if (value == null) return { count: 0, value: null }
  if (Array.isArray(value)) return { count: value.length, value }
  if (typeof value === 'object') return { count: 1, value }
  return { count: 1, value }
}

function fmt(value: unknown): string {
  if (value === '__NOT_FOUND__') return '⚠ store 不存在 (需要 onupgradeneeded 重建)'
  if (value == null) return 'null'
  return JSON.stringify(value, null, 2)
}

async function copyAll() {
  if (!data.value) return
  const json = JSON.stringify(data.value, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    copyMsg.value = '已复制'
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = json
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      copyMsg.value = '已复制'
    } catch {
      copyMsg.value = '复制失败'
    }
  }
  setTimeout(() => { copyMsg.value = '' }, 2000)
}

watch(() => ui.state.modal, async (v) => {
  isOpen.value = v === 'dbInspect'
  if (isOpen.value) await load()
}, { immediate: true })

function close() {
  ui.closeModal()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @click.self="close">
      <div class="modal modal--wide">
        <div class="modal__header">
          <span>IndexedDB 诊断</span>
          <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
        </div>
        <div class="modal__body db-inspect">
          <div v-if="dbMeta" class="db-inspect__meta">
            数据库: <b>{{ dbMeta.name }}</b> · 版本: <b>{{ dbMeta.version }}</b> · Object Stores: <b>{{ dbMeta.stores.length }}</b>
          </div>
          <div v-if="error" class="db-inspect__error">{{ error }}</div>
          <div v-if="loading" class="db-inspect__loading">读取中…</div>
          <div v-if="data" class="db-inspect__list">
            <div v-for="name in ALL_STORES" :key="name" class="db-inspect__item">
              <div class="db-inspect__item-head">
                <span class="db-inspect__label">{{ STORE_LABELS[name] }}</span>
                <span class="db-inspect__count">
                  {{ data[name].value === '__NOT_FOUND__' ? '—' : `${data[name].count} 条` }}
                </span>
              </div>
              <pre class="db-inspect__pre">{{ fmt(data[name].value) }}</pre>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <span v-if="copyMsg" class="db-inspect__copy-msg">{{ copyMsg }}</span>
          <button class="btn" @click="load" :disabled="loading">刷新</button>
          <button class="btn" @click="copyAll" :disabled="!data || loading">复制全部为 JSON</button>
          <button class="btn btn--primary" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.db-inspect {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
}
.db-inspect__meta {
  font-size: 12px;
  color: var(--color-text-muted);
}
.db-inspect__error {
  padding: 8px 12px;
  border-radius: 6px;
  background: #fff5e6;
  color: #b56e00;
  font-size: 13px;
}
.db-inspect__loading {
  text-align: center;
  padding: 16px;
  color: var(--color-text-muted);
}
.db-inspect__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.db-inspect__item {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--color-bg-elev);
}
.db-inspect__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.db-inspect__label {
  font-size: 13px;
  font-weight: 600;
}
.db-inspect__count {
  font-size: 12px;
  color: var(--color-text-muted);
}
.db-inspect__pre {
  margin: 0;
  padding: 8px;
  background: var(--color-bg-sunken);
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
.db-inspect__copy-msg {
  font-size: 12px;
  color: var(--color-success);
}
</style>
