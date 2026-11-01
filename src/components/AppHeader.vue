<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/composables/useSession'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useUi } from '@/composables/useUi'

const { current, totalPickedThisSession } = useSession()
const lib = usePermanentRoster()
const ui = useUi()

const picked = computed(() => totalPickedThisSession.value)
const libraryCount = computed(() => lib.groups.value.length)

const roundText = computed(() => {
  if (!current.value) return '未开始'
  return picked.value > 0 ? `本轮已抽 ${picked.value} 人` : '本轮还没抽'
})
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <button
        class="app-header__toggle"
        @click="ui.toggleSide()"
        :title="ui.state.sideCollapsed ? '展开侧栏' : '收起侧栏'"
        :aria-label="ui.state.sideCollapsed ? '展开侧栏' : '收起侧栏'"
        :aria-expanded="!ui.state.sideCollapsed"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
          <path d="M8 3.5v13" />
        </svg>
      </button>
      <span class="app-header__brand">Kleros</span>
      <span class="app-header__round">
        <span v-if="picked > 0" class="app-header__dot"></span>
        {{ roundText }}
      </span>
    </div>

    <div class="app-header__actions">
      <button
        class="btn"
        @click="ui.openModal('library')"
        title="管理名册：长期保存的名单，可整册加入当前名单"
      >
        名册{{ libraryCount ? ` ${libraryCount}` : '' }}
      </button>
    </div>
  </header>
</template>
