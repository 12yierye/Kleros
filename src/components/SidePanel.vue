<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useUi } from '@/composables/useUi'
import BlackListSection from './BlackListSection.vue'
import WhiteListSection from './WhiteListSection.vue'
import PickOptionsSection from './PickOptionsSection.vue'
import HistorySection from './HistorySection.vue'

const { prefs } = useSettings()
const ui = useUi()

const collapsed = computed(() => ui.state.sideCollapsed)

function isOpen(key: string, fallback: boolean): boolean {
  const v = prefs.value.sidePanelSections[key]
  return v === undefined ? fallback : v
}

function toggle(key: string) {
  prefs.value.sidePanelSections[key] = !isOpen(key, true)
}

function onSettings() {
  ui.openModal('settings')
}
</script>

<template>
  <aside class="app-side" v-show="!collapsed">
    <div class="app-side__inner">
      <div class="app-side__body">
        <div class="side-group">
          <div class="side-group__label">过滤条件</div>
          <BlackListSection
            :open="isOpen('blacklist', true)"
            @update:open="toggle('blacklist')"
          />
          <WhiteListSection
            :open="isOpen('whitelist', true)"
            @update:open="toggle('whitelist')"
          />
        </div>

        <div class="side-group">
          <div class="side-group__label">抽取参数</div>
          <PickOptionsSection
            :open="isOpen('pickOptions', true)"
            @update:open="toggle('pickOptions')"
          />
        </div>

        <div class="side-group">
          <div class="side-group__label">历史会话</div>
          <HistorySection
            :open="isOpen('history', true)"
            @update:open="toggle('history')"
          />
        </div>
      </div>

      <div class="app-side__footer">
        <button class="btn btn--ghost" @click="onSettings" style="width: 100%;">设置</button>
      </div>
    </div>
  </aside>
</template>
