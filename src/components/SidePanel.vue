<script setup lang="ts">
import { computed } from 'vue'
import { useUi } from '@/composables/useUi'
import type { SideView } from '@/composables/useUi'
import BlackListSection from './BlackListSection.vue'
import WhiteListSection from './WhiteListSection.vue'
import PickOptionsSection from './PickOptionsSection.vue'

const ui = useUi()

const collapsed = computed(() => ui.state.sideCollapsed)
const active = computed(() => ui.state.sideView)

const views: { key: SideView; label: string; title: string }[] = [
  { key: 'filters', label: '过滤', title: '黑白名单' },
  { key: 'options', label: '参数', title: '抽取参数' },
]

function onSettings() {
  ui.openModal('settings')
}
</script>

<template>
  <aside class="app-side" :class="{ 'app-side--rail': collapsed }">
    <div class="app-side__inner">
      <div class="app-side__tabs" role="tablist">
        <button
          v-for="v in views"
          :key="v.key"
          class="side-tab"
          :class="{ 'side-tab--active': active === v.key }"
          role="tab"
          :aria-selected="active === v.key"
          @click="ui.showSideView(v.key)"
        >{{ v.label }}</button>
      </div>

      <div class="app-side__body">
        <template v-if="active === 'filters'">
          <BlackListSection />
          <WhiteListSection />
        </template>
        <PickOptionsSection v-else />
      </div>

      <div class="app-side__footer">
        <button class="btn btn--ghost app-side__settings" @click="onSettings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
          </svg>
          设置
        </button>
      </div>
    </div>

    <div class="app-side__rail">
      <button
        class="rail-btn"
        :class="{ 'rail-btn--active': active === 'filters' }"
        @click="ui.showSideView('filters')"
        title="黑白名单"
        aria-label="黑白名单"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 5h13.6l-5.2 6v4.5l-3.2 1.4V11L3.2 5z" /></svg>
      </button>
      <button
        class="rail-btn"
        :class="{ 'rail-btn--active': active === 'options' }"
        @click="ui.showSideView('options')"
        title="抽取参数"
        aria-label="抽取参数"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 7h6.5M15.5 7H17M3 13h1.5M8.5 13H17" /><circle cx="12.2" cy="7" r="1.7" /><circle cx="6" cy="13" r="1.7" /></svg>
      </button>
      <div class="rail-spacer"></div>

      <button class="rail-btn" @click="onSettings" title="设置" aria-label="设置">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
        </svg>
      </button>
    </div>
  </aside>
</template>
