<script setup lang="ts">
import { provide, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { provideUi, useUi } from '@/composables/useUi'
import { useSettings } from '@/composables/useSettings'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useSessionManager } from '@/composables/useSessionManager'
import { usePicker } from '@/composables/usePicker'
import { useFilePersistence } from '@/composables/useFilePersistence'
import { exportAllDB, dbReady } from '@/composables/useDB'
import { DEFAULT_PREFERENCES } from '@/types/settings'
import { setDebug } from '@/utils/debug'
import { debug } from '@/utils/debug'
import type { UserPreferences } from '@/types/settings'
import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { Session, SessionSummary } from '@/types/session'

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
import DBInspectDialog from '@/components/DBInspectDialog.vue'
import BindingGroupsDialog from '@/components/BindingGroupsDialog.vue'

if (typeof window !== 'undefined') {
  const p = new URL(window.location.href).searchParams
  if (p.get('debug') === '1') setDebug(true)
}

const ui = provideUi()
const { prefs, update } = useSettings()
const filePersistence = useFilePersistence()
const sessionRefs = useSession()
const rosterRefs = useRoster()
const permanentRefs = usePermanentRoster()
const bwRefs = useBlackWhiteList()
const settingsRefs = useSettings()

const session = useSessionManager()
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

let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave() {
  if (!filePersistence.isConnected.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const data = await exportAllDB()
    await filePersistence.saveToFile(data)
    debug('app', `auto-save done, picks=${(data.sessions.current as Session)?.totalPicked ?? 0}`)
  }, 500)
}

onMounted(async () => {
  debug('app', '======== STARTUP ========')
  await dbReady
  debug('app', 'dbReady, starting session.init (IndexedDB)')

  await session.init()

  await filePersistence.init()
  const data = await filePersistence.loadFromFile()

  if (data) {
    const dbPicks = sessionRefs.history.value.reduce((sum, s) => sum + s.totalPicked, 0)
    const history = (data.sessions.history as { totalPicked: number }[])
    const filePicks = history.reduce((sum, s: { totalPicked: number }) => sum + (s.totalPicked ?? 0), 0)

    debug('app', `compare: dbPicks=${dbPicks} vs filePicks=${filePicks}`)

    if (filePicks > dbPicks) {
      debug('app', 'backup newer, restoring from backup')
      rosterRefs.entries.value = data.roster.temporary as RosterEntry[]
      permanentRefs.entries.value = data.roster.permanent as PermanentEntry[]
      bwRefs.list.value = data.lists
      sessionRefs.current.value = data.sessions.current as Session | null
      sessionRefs.history.value = data.sessions.history as (Session | SessionSummary)[]
      if (data.prefs) {
        settingsRefs.prefs.value = {
          ...DEFAULT_PREFERENCES,
          ...(data.prefs as Partial<UserPreferences>),
        }
      }
    } else {
      debug('app', 'IndexedDB equal or newer, keeping IndexedDB')
    }
  }

  watch(
    [
      () => sessionRefs.current.value,
      () => sessionRefs.history.value,
      () => rosterRefs.entries.value,
      () => rosterRefs.groups.value,
      () => permanentRefs.entries.value,
      () => bwRefs.list.value,
      () => settingsRefs.prefs.value,
    ],
    debouncedSave,
    { deep: true }
  )

  if (filePersistence.isConnected.value) {
    debouncedSave()
  }

  window.addEventListener('keydown', handleKeydown)
  debug('app', '======== STARTUP DONE ========')
})

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
    <DBInspectDialog />
    <BindingGroupsDialog />
  </div>
</template>
