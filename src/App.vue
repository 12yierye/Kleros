<script setup lang="ts">
import { provide, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { provideUi, useUi } from '@/composables/useUi'
import { useSettings, normalizePrefs } from '@/composables/useSettings'
import { useSession, onNewRound, normalizeBundles } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { usePicker } from '@/composables/usePicker'
import { useFilePersistence } from '@/composables/useFilePersistence'
import { exportAllDB, dbReady } from '@/composables/useDB'
import { DEFAULT_PREFERENCES } from '@/types/settings'
import { setDebug } from '@/utils/debug'
import { debug } from '@/utils/debug'
import type { UserPreferences } from '@/types/settings'
import type { RosterEntry } from '@/types/roster'
import type { Round } from '@/types/session'

import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import SidePanel from '@/components/SidePanel.vue'
import RosterPanel from '@/components/RosterPanel.vue'
import PickerControls from '@/components/PickerControls.vue'
import PickerStage from '@/components/PickerStage.vue'
import PickerHistory from '@/components/PickerHistory.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import RenameDialog from '@/components/RenameDialog.vue'
import GlobalRenameDialog from '@/components/GlobalRenameDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DBInspectDialog from '@/components/DBInspectDialog.vue'
import BundlesDialog from '@/components/BundlesDialog.vue'
import LibraryDialog from '@/components/LibraryDialog.vue'

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

const session = sessionRefs
const picker = usePicker()

if (!prefs.value.rememberLayout) {
  update('layoutMode', 'tabs')
}

function startNewRound() {
  session.startNewRound()
  picker.lastResults.value = []
  picker.lastError.value = null
}
provide('startNewRound', startNewRound)

/* 新一轮开始时，清掉名单上的「已抽」灰态 */
onNewRound(() => {
  rosterRefs.resetPickedFlags()
  session.initLastSeen()
})

/* 侧栏折叠：UI 状态 ↔ 偏好，双向同步（否则刷新即还原） */
ui.state.sideCollapsed = prefs.value.sidePanelCollapsed

let suppressPersist = false
watch(
  () => ui.state.sideCollapsed,
  (v) => {
    if (suppressPersist) return
    if (prefs.value.sidePanelCollapsed !== v) prefs.value.sidePanelCollapsed = v
  },
  { flush: 'sync' }
)
watch(
  () => prefs.value.sidePanelCollapsed,
  (v) => {
    if (ui.state.sideCollapsed !== v) ui.state.sideCollapsed = v
  }
)

/* 窄屏自动收起（只收不放，且不写入偏好，避免污染桌面端的记忆） */
let narrowMq: MediaQueryList | null = null
function onNarrowChange(e: MediaQueryList | MediaQueryListEvent) {
  if (!e.matches) return
  suppressPersist = true
  ui.state.sideCollapsed = true
  suppressPersist = false
}

const viewTab = ref<'pick' | 'roster'>('pick')

function onPick(payload: { mode: 'single' | 'multi'; count: number }) {
  void picker.trigger(payload)
}

watch(
  () => prefs.value.theme,
  (theme) => { document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light' },
  { immediate: true }
)

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
    debug('app', `auto-save done, picks=${(data.sessions.current as Round | null)?.totalPicked ?? 0}`)
  }, 500)
}

onMounted(async () => {
  debug('app', '======== STARTUP ========')
  await dbReady
  normalizePrefs()
  debug('app', 'dbReady, restoring state')

  sessionRefs.ensureRound()
  sessionRefs.initLastSeen()
  // 当前名单的分组是运行时从条目里重建的，启动必须先初始化
  rosterRefs.ensureDefaultGroup()

  narrowMq = window.matchMedia('(max-width: 900px)')
  onNarrowChange(narrowMq)
  narrowMq.addEventListener('change', onNarrowChange)

  await filePersistence.init()
  const data = await filePersistence.loadFromFile()

  // 备份只是本地库的镜像，仅在本地名单为空时兜底
  if (data && rosterRefs.entries.value.length === 0 && Array.isArray(data.roster.temporary) && data.roster.temporary.length > 0) {
    debug('app', 'local empty, restoring from backup')
    rosterRefs.entries.value = data.roster.temporary as RosterEntry[]
    permanentRefs.replaceAll(data.roster.permanent)
    bwRefs.list.value = data.lists
    const backupRound = data.sessions.current as (Round & { relations?: unknown }) | null
    const backupBundles = normalizeBundles(backupRound?.bundles ?? backupRound?.relations)
    sessionRefs.startNewRound()
    if (backupBundles.length > 0 && sessionRefs.current.value) {
      sessionRefs.current.value = { ...sessionRefs.current.value, bundles: backupBundles }
    }
    if (data.prefs) {
      settingsRefs.prefs.value = {
        ...DEFAULT_PREFERENCES,
        ...(data.prefs as Partial<UserPreferences>),
      }
    }
  }

  watch(
    [
      () => sessionRefs.current.value,
      () => rosterRefs.entries.value,
      () => rosterRefs.groups.value,
      () => permanentRefs.groups.value,
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

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  narrowMq?.removeEventListener('change', onNarrowChange)
})
</script>

<template>
  <div class="app-root">
    <AppHeader />

    <div class="app-body">
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
          <PickerHistory />
        </template>
        <template v-else>
          <RosterPanel />
        </template>
      </main>

      <!-- 横向：左右并排（左抽取 · 右名单） -->
      <main v-else-if="prefs.layoutMode === 'split'" class="app-main app-main--split">
        <div class="app-main__col">
          <PickerControls @pick="onPick" />
          <PickerStage />
          <PickerHistory />
        </div>
        <div class="app-main__col">
          <RosterPanel />
        </div>
      </main>

      <!-- 纵向：上下堆叠（上抽取 · 下名单） -->
      <main v-else class="app-main">
        <PickerControls @pick="onPick" />
        <PickerStage />
        <PickerHistory />
        <RosterPanel />
      </main>
    </div>

    <AppFooter />

    <SettingsDialog />
    <RenameDialog />
    <GlobalRenameDialog />
    <ConfirmDialog />
    <DBInspectDialog />
    <BundlesDialog />
    <LibraryDialog />
  </div>
</template>
