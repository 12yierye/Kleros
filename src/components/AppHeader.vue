<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/composables/useSession'
import { useSettings } from '@/composables/useSettings'
import { useUi } from '@/composables/useUi'
import type { LayoutMode } from '@/types/settings'

const { current, totalPickedThisSession, startNewSession } = useSession()
const { prefs, update } = useSettings()
const ui = useUi()

const sessionLabel = computed(() => {
  if (!current.value) return '未开始'
  return `${current.value.title} 进行中 · 抽 ${totalPickedThisSession.value} 人`
})

const layoutModes: { key: LayoutMode; label: string; title: string }[] = [
  { key: 'tabs', label: '标签', title: '标签页模式' },
  { key: 'stacked', label: '上下', title: '上下堆叠' },
  { key: 'split', label: '左右', title: '左右分栏' },
]

function onNewSession() {
  void ui.askConfirm({
    title: '开启新会话？',
    message: '当前会话将被归档（仍可在历史中查看），本轮已抽过的人将重新可被抽。',
    confirmText: '开启新会话',
  }).then(ok => {
    if (ok) startNewSession()
  })
}

function onToggleSide() {
  ui.toggleSide()
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__title">
      <span>Kleros · 点名器</span>
      <span class="app-header__badge">{{ sessionLabel }}</span>
    </div>
    <div class="app-header__actions">
      <div class="radio-group" style="margin-right: 4px;" title="视图切换">
        <button
          v-for="m in layoutModes"
          :key="m.key"
          class="radio-group__item"
          :class="{ 'radio-group__item--active': prefs.layoutMode === m.key }"
          @click="update('layoutMode', m.key)"
          :title="m.title"
        >{{ m.label }}</button>
      </div>
      <button
        class="btn"
        @click="onNewSession"
        :disabled="!current"
        title="归档当前会话并开启新会话"
      >
        新会话
      </button>
      <button
        class="btn btn--icon btn--ghost"
        @click="onToggleSide"
        title="切换侧栏"
        aria-label="切换侧栏"
      >
        ☰
      </button>
    </div>
  </header>
</template>
