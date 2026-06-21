<script setup lang="ts">
import { provide, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { provideUi, useUi } from '@/composables/useUi'
import { useSettings } from '@/composables/useSettings'
import { useSessionManager } from '@/composables/useSessionManager'
import { usePicker } from '@/composables/usePicker'

import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import SidePanel from '@/components/SidePanel.vue'
import InputPanel from '@/components/InputPanel.vue'
import RosterPanel from '@/components/RosterPanel.vue'
import PickerControls from '@/components/PickerControls.vue'
import PickerStage from '@/components/PickerStage.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import RenameDialog from '@/components/RenameDialog.vue'
import GlobalRenameDialog from '@/components/GlobalRenameDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = provideUi()
const { prefs, update } = useSettings()
const session = useSessionManager()
session.init()
const picker = usePicker()

if (!prefs.value.rememberLayout) {
  update('layoutMode', 'tabs')
}

function switchSessionWithGuard(id: string) {
  if (picker.isAnimating.value) {
    picker.blockAttempt.value = true
    setTimeout(() => { picker.blockAttempt.value = false }, 2000)
    return
  }
  session.switchSession(id)
}

provide('switchSession', switchSessionWithGuard)
provide('deleteSessions', session.deleteSessions)

ui.state.sideCollapsed = prefs.value.sidePanelCollapsed

const viewTab = ref<'pick' | 'roster'>('pick')

function onPick(payload: { mode: 'single' | 'multi'; count: number }) {
  void picker.trigger(payload)
}

watch(() => prefs.value.animationSpeed, (speed) => {
  const map: Record<string, string> = { off: '0s', fast: '0.12s', normal: '0.25s', slow: '0.5s' }
  document.documentElement.style.setProperty('--anim-duration', map[speed] || '0.25s')
}, { immediate: true })

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (ui.state.modal) { ui.closeModal(); return }
    if (ui.state.confirm) { ui.state.confirm.resolve(false); ui.state.confirm = null; return }
    return
  }
  if (
    e.key === ' ' &&
    !e.repeat &&
    prefs.value.pickStyle === 'animate' &&
    !ui.state.modal &&
    !ui.state.confirm
  ) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    e.preventDefault()
    if (picker.isPicking.value) {
      picker.isPicking.value = false
    } else {
      picker.startAnimate()
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="app-root">
    <AppHeader />

    <div class="app-body" :class="{ 'side-collapsed': ui.state.sideCollapsed }">
      <SidePanel />

      <!-- 标签页模式 -->
      <main v-if="prefs.layoutMode === 'tabs'" class="app-main">
        <div class="view-tabs">
          <button
            class="view-tabs__tab"
            :class="{ 'view-tabs__tab--active': viewTab === 'pick' }"
            @click="viewTab = 'pick'"
          >抽取</button>
          <button
            class="view-tabs__tab"
            :class="{ 'view-tabs__tab--active': viewTab === 'roster' }"
            @click="viewTab = 'roster'"
          >名单</button>
        </div>
        <template v-if="viewTab === 'pick'">
          <PickerControls @pick="onPick" />
          <PickerStage />
        </template>
        <template v-else>
          <InputPanel />
          <RosterPanel />
        </template>
      </main>

      <!-- 左右分栏模式 -->
      <main v-else-if="prefs.layoutMode === 'split'" class="app-main app-main--split">
        <div class="app-main__col">
          <InputPanel />
          <RosterPanel />
        </div>
        <div class="app-main__col">
          <PickerControls @pick="onPick" />
          <PickerStage />
        </div>
      </main>

      <!-- 默认上下堆叠 -->
      <main v-else class="app-main">
        <InputPanel />
        <RosterPanel />
        <PickerControls @pick="onPick" />
        <PickerStage />
      </main>
    </div>

    <AppFooter />

    <SettingsDialog />
    <RenameDialog />
    <GlobalRenameDialog />
    <ConfirmDialog />
  </div>
</template>
