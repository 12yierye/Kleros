<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import { useSession } from '@/composables/useSession'
import { useUi } from '@/composables/useUi'
import { isFullSession } from '@/types/session'
import SidePanelSection from './SidePanelSection.vue'

const { history, current } = useSession()
const ui = useUi()

const switchSession = inject<(id: string) => void>('switchSession')!
const delSessions = inject<(ids: string[]) => void>('deleteSessions')!

const open = defineModel<boolean>('open', { default: false })

const batchMode = ref(false)
const selected = ref<Set<string>>(new Set())

function fmtFull(t: number) {
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

const items = computed(() => {
  return history.value.map(s => {
    const isCurrent = current.value?.id === s.id
    const full = isFullSession(s)
    const lastPickTime = full && s.picks.length > 0
      ? fmtFull(s.picks[s.picks.length - 1].time)
      : null
    const tooltip = `创建于 ${fmtFull(s.startedAt)}${lastPickTime ? ` · 最后抽取 ${lastPickTime}` : ''}`
    return { session: s, isCurrent, full, tooltip }
  })
})

const allSelected = computed(() =>
  items.value.length > 0 && items.value.every(i => selected.value.has(i.session.id))
)

function enterBatchMode() {
  selected.value = new Set()
  batchMode.value = true
}

function exitBatchMode() {
  selected.value = new Set()
  batchMode.value = false
}

function toggleSelect(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(items.value.map(i => i.session.id))
  }
}

function onSwitch(id: string) {
  const item = items.value.find(i => i.session.id === id)
  if (!item || item.isCurrent || !item.full) return
  void ui.askConfirm({
    title: '切换会话？',
    message: '当前会话状态将被保存，切换到所选会话。',
    confirmText: '切换',
  }).then(ok => {
    if (ok) switchSession(id)
  })
}

function onDeleteSelected() {
  const ids = [...selected.value]
  if (ids.length === 0) return
  void ui.askConfirm({
    title: `删除 ${ids.length} 个会话？`,
    message: '此操作不可撤销。若删除了当前会话，将自动创建新会话。',
    danger: true,
    confirmText: '删除',
  }).then(ok => {
    if (ok) {
      delSessions(ids)
      selected.value = new Set()
      exitBatchMode()
    }
  })
}
</script>

<template>
  <SidePanelSection id="history" title="历史会话" :count="history.length" v-model:open="open">
    <div v-if="items.length === 0" class="text-subtle" style="font-size: 12px;">尚无历史</div>
    <template v-else>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <template v-if="batchMode">
          <label class="checkbox" style="font-size: 12px;">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            全选
          </label>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn--ghost" style="font-size: 11px; padding: 2px 6px;" @click="exitBatchMode">取消</button>
            <button class="btn btn--danger" style="font-size: 11px; padding: 2px 6px;" :disabled="selected.size === 0" @click="onDeleteSelected">删除所选</button>
          </div>
        </template>
        <template v-else>
          <span></span>
          <button class="btn btn--ghost" style="font-size: 11px; padding: 2px 6px;" @click="enterBatchMode">批量操作</button>
        </template>
      </div>
      <ul style="display: flex; flex-direction: column; gap: 2px;">
        <li
          v-for="{ session, isCurrent, full, tooltip } in items"
          :key="session.id"
          class="history-item"
          :class="{ 'history-item--active': isCurrent, 'history-item--compressed': !full }"
          :title="tooltip"
          :style="{ cursor: full && !isCurrent ? 'pointer' : 'default', opacity: full ? 1 : 0.5 }"
          @click="full && !isCurrent && onSwitch(session.id)"
        >
          <input
            v-if="batchMode"
            type="checkbox"
            style="width: 14px; height: 14px; flex-shrink: 0; accent-color: var(--color-primary);"
            :checked="selected.has(session.id)"
            @click.stop
            @change="toggleSelect(session.id)"
          />
          <div style="min-width: 0; flex: 1;">
            <div class="ellipsis" style="font-size: 12px;">
              {{ session.title }}
            </div>
            <div class="history-item__meta">
              抽 {{ session.totalPicked }} 人
              <span v-if="!full" style="color: var(--color-text-subtle);">（概要）</span>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </SidePanelSection>
</template>
