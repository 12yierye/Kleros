<script setup lang="ts">
import { provide, ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
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
import IdleTextsDialog from '@/components/IdleTextsDialog.vue'

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

/* 新一轮开始时，清掉名单上的「已抽」灰态，并清空结果区（不能留下上一轮的名字） */
onNewRound(() => {
  rosterRefs.resetPickedFlags()
  session.initLastSeen()
  picker.clearDisplay()
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
let tightSplitMq: MediaQueryList | null = null
function onNarrowChange(e: MediaQueryList | MediaQueryListEvent) {
  if (!e.matches) return
  suppressPersist = true
  ui.state.sideCollapsed = true
  suppressPersist = false
}

/** 横向布局 + 中等宽度时，过滤栏自动收成图标轨，把宽度让给舞台 */
function collapseSideForTightSplit() {
  if (!tightSplitMq?.matches) return
  if (prefs.value.layoutMode !== 'split') return
  suppressPersist = true
  ui.state.sideCollapsed = true
  suppressPersist = false
}

watch(
  () => prefs.value.layoutMode,
  (mode) => {
    if (mode === 'split') collapseSideForTightSplit()
  }
)

const viewTab = ref<'pick' | 'roster'>('pick')
const splitRailOpen = ref(true)
const stackRosterOpen = ref(true)
const rosterCount = computed(() => rosterRefs.entries.value.length)
const pickTabRef = ref<HTMLButtonElement | null>(null)
const rosterTabRef = ref<HTMLButtonElement | null>(null)

function onViewTabsKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  viewTab.value = viewTab.value === 'pick' ? 'roster' : 'pick'
  void nextTick(() => {
    (viewTab.value === 'pick' ? pickTabRef.value : rosterTabRef.value)?.focus()
  })
}

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
    // 确认框永远在模态框之上，Esc 先关最上层
    if (ui.state.confirm) { ui.state.confirm.resolve(false); ui.state.confirm = null; return }
    if (ui.state.modal) { ui.closeModal(); return }
    return
  }
  if (
    e.key === ' ' &&
    !e.repeat &&
    prefs.value.pickStyle === 'animate' &&
    !ui.state.modal &&
    !ui.state.confirm
  ) {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest(
      'input, textarea, select, button, a, [tabindex], [contenteditable="true"], [role="button"], [role="tab"], [role="switch"]'
    )) return
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

  tightSplitMq = window.matchMedia('(max-width: 1100px)')
  collapseSideForTightSplit()
  tightSplitMq.addEventListener('change', collapseSideForTightSplit)

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
  tightSplitMq?.removeEventListener('change', collapseSideForTightSplit)
})
</script>

<template>
  <div class="app-root">
    <AppHeader />

    <div class="app-body">
      <SidePanel />

      <!-- 标签页模式 -->
      <main v-if="prefs.layoutMode === 'tabs'" key="tabs" class="app-main">
        <div
          class="view-tabs"
          role="tablist"
          aria-label="主视图"
          @keydown="onViewTabsKeydown"
        >
          <button
            id="view-tab-pick"
            ref="pickTabRef"
            class="view-tabs__tab"
            :class="{ 'view-tabs__tab--active': viewTab === 'pick' }"
            role="tab"
            :aria-selected="viewTab === 'pick'"
            aria-controls="view-panel-pick"
            :tabindex="viewTab === 'pick' ? 0 : -1"
            @click="viewTab = 'pick'"
          >抽取</button>
          <button
            id="view-tab-roster"
            ref="rosterTabRef"
            class="view-tabs__tab"
            :class="{ 'view-tabs__tab--active': viewTab === 'roster' }"
            role="tab"
            :aria-selected="viewTab === 'roster'"
            aria-controls="view-panel-roster"
            :tabindex="viewTab === 'roster' ? 0 : -1"
            @click="viewTab = 'roster'"
          >名单</button>
        </div>
        <Transition name="view-fade" mode="out-in">
          <div
            v-if="viewTab === 'pick'"
            id="view-panel-pick"
            key="pick"
            class="view-panel"
            role="tabpanel"
            aria-labelledby="view-tab-pick"
          >
            <PickerControls @pick="onPick" />
            <PickerStage @go-roster="viewTab = 'roster'" />
            <PickerHistory />
          </div>
          <div
            v-else
            id="view-panel-roster"
            key="roster"
            class="view-panel"
            role="tabpanel"
            aria-labelledby="view-tab-roster"
          >
            <RosterPanel />
          </div>
        </Transition>
      </main>

      <!-- 横向：主舞台 + 右侧名单栏（可收起） -->
      <main v-else-if="prefs.layoutMode === 'split'" key="split" class="app-main app-main--split">
        <div class="app-main__col app-main__col--stage">
          <PickerControls @pick="onPick" />
          <PickerStage />
          <PickerHistory />
        </div>

        <aside
          class="app-main__col app-main__col--roster"
          :class="{ 'app-main__col--roster-collapsed': !splitRailOpen }"
          :aria-hidden="!splitRailOpen"
          :inert="!splitRailOpen"
          aria-label="当前名单栏"
        >
          <RosterPanel collapsible @collapse="splitRailOpen = false" />
        </aside>
        <button
          class="roster-rail-reopen"
          :class="{ 'roster-rail-reopen--hidden': splitRailOpen }"
          :tabindex="splitRailOpen ? -1 : 0"
          :aria-hidden="splitRailOpen"
          type="button"
          title="展开名单栏"
          aria-label="展开名单栏"
          @click="splitRailOpen = true"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 4L6 10l6 6" />
          </svg>
        </button>
      </main>

      <!-- 纵向：上舞台 + 底部名单 dock（可收起） -->
      <main v-else key="stacked" class="app-main app-main--stacked">
        <div class="app-main__stack-main">
          <PickerControls @pick="onPick" />
          <PickerStage />
          <PickerHistory />
        </div>

        <div class="app-main__dock-region">
          <div
            class="app-main__dock-collapse"
            :class="{ 'app-main__dock-collapse--closed': !stackRosterOpen }"
          >
            <div class="app-main__dock-clip">
              <aside
                class="app-main__dock"
                :aria-hidden="!stackRosterOpen"
                :inert="!stackRosterOpen"
                aria-label="当前名单 dock"
              >
                <RosterPanel collapsible collapse-direction="down" @collapse="stackRosterOpen = false" />
              </aside>
            </div>
          </div>
          <button
            class="stack-roster-reopen"
            :class="{ 'stack-roster-reopen--visible': !stackRosterOpen }"
            :tabindex="stackRosterOpen ? -1 : 0"
            :aria-hidden="stackRosterOpen"
            type="button"
            @click="stackRosterOpen = true"
          >名单 {{ rosterCount }} · 展开</button>
        </div>
      </main>
    </div>

    <AppFooter />

    <SettingsDialog />
    <IdleTextsDialog />
    <RenameDialog />
    <GlobalRenameDialog />
    <ConfirmDialog />
    <DBInspectDialog />
    <BundlesDialog />
    <LibraryDialog />
  </div>
</template>
