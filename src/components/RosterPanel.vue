<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useBundles } from '@/composables/useBundles'
import { useUi } from '@/composables/useUi'
import NameChip from './NameChip.vue'
import InputPanel from './InputPanel.vue'
import type { RosterEntry, RosterMark } from '@/types/roster'

const roster = useRoster()
const lib = usePermanentRoster()
const { isBlack } = useBlackWhiteList()
const bundles = useBundles()
const ui = useUi()

const currentEntries = computed(() => roster.entries.value)
const addOpen = ref(currentEntries.value.length === 0)

/* ---------- 轻提示 ---------- */
const flash = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

function say(text: string) {
  flash.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = null }, 2600)
}

/* ---------- 当前名单 ---------- */
const batchMode = ref(false)
const batchSelected = ref<Set<string>>(new Set())
const targetGroupId = ref('')

function toggleBatch() {
  batchMode.value = !batchMode.value
  batchSelected.value = new Set()
}

function toggleSelect(uid: string) {
  const s = new Set(batchSelected.value)
  if (s.has(uid)) s.delete(uid)
  else s.add(uid)
  batchSelected.value = s
}

function onDeleteSelected() {
  const ids = [...batchSelected.value]
  if (ids.length === 0) return
  roster.deleteEntries(ids)
  batchSelected.value = new Set()
  say(`已删除 ${ids.length} 人`)
}

function onClearCurrent() {
  if (currentEntries.value.length === 0) return
  void ui.askConfirm({
    title: '清空当前名单？',
    message: '只清空这次抽取用的名单，名册不受影响。',
    danger: true,
    confirmText: '清空',
  }).then(ok => {
    if (ok) roster.deleteEntries(currentEntries.value.map(e => e.uid))
  })
}

const targetOptions = computed(() => lib.groups.value)

function ensureTarget() {
  if (targetOptions.value.length === 0) {
    const id = lib.addGroup('我的名册')
    targetGroupId.value = id
    return id
  }
  if (!targetOptions.value.some(g => g.id === targetGroupId.value)) {
    targetGroupId.value = targetOptions.value[0].id
  }
  return targetGroupId.value
}

function onStoreSelected() {
  const ids = [...batchSelected.value]
  if (ids.length === 0) return
  const groupId = ensureTarget()
  const group = lib.groups.value.find(g => g.id === groupId)
  void ui.askConfirm({
    title: `存入「${group?.name ?? '名册'}」？`,
    message: `${ids.length} 人将从当前名单移出，存入名册，之后可随时整册取回。`,
    confirmText: '存入',
  }).then(ok => {
    if (!ok) return
    const snap = roster.promoteEntries(ids)
    for (const s of snap) lib.importOne(s, groupId)
    batchSelected.value = new Set()
    batchMode.value = false
    say(`已存入 ${snap.length} 人`)
  })
}

function onRenameCurrent(e: RosterEntry) {
  ui.openRename(e.uid, 'roster')
}

/* ---------- 归属标记：绑定小组 + 名册 ---------- */
const EMPTY_MARKS: RosterMark[] = []

const marksMap = computed(() => {
  const map = new Map<string, RosterMark[]>()
  const books = lib.groups.value
  for (const e of currentEntries.value) {
    const marks: RosterMark[] = []
    for (const b of bundles.getBundlesForUid(e.uid)) {
      marks.push({ kind: 'bundle', name: b.name, color: b.color })
    }
    for (const g of books) {
      if (g.members.some(m => m.name === e.name)) {
        marks.push({ kind: 'book', name: g.name, color: g.color })
      }
    }
    // 同名同色的条目只留一条，避免 tooltip 重复
    const seen = new Set<string>()
    map.set(e.uid, marks.filter(m => {
      const key = `${m.kind}-${m.name}-${m.color}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }))
  }
  return map
})

function marksOf(uid: string): RosterMark[] {
  return marksMap.value.get(uid) ?? EMPTY_MARKS
}

function accentOf(uid: string): string {
  return marksOf(uid)[0]?.color ?? ''
}
</script>

<template>
  <div class="roster-page">
    <Transition name="toast">
      <div v-if="flash" class="flash">{{ flash }}</div>
    </Transition>

    <section class="main-section">
      <div class="block-head">
        <div class="block-head__text">
          <h3 class="block-head__title">
            当前名单
            <span class="block-head__count">{{ currentEntries.length }}</span>
          </h3>
          <p class="block-head__sub">这次抽取用 · 可随时清空</p>
        </div>
        <div class="block-head__actions">
          <button class="btn btn--sm btn--primary" @click="addOpen = !addOpen">{{ addOpen ? '收起' : '＋ 添加' }}</button>
          <span class="tip">
            <button class="btn btn--sm" @click="ui.openBundles()">
              绑定{{ bundles.all.value.length ? ` ${bundles.all.value.length}` : '' }}
            </button>
            <span class="tip__bubble">同一小组里的人会一起被抽中</span>
          </span>
          <button class="btn btn--sm" :class="{ 'btn--primary': batchMode }" @click="toggleBatch">
            {{ batchMode ? '退出批量' : '批量' }}
          </button>
          <button class="btn btn--sm btn--danger" :disabled="currentEntries.length === 0" @click="onClearCurrent">清空</button>
        </div>
      </div>

      <div v-if="batchMode" class="batch-bar">
        <span class="text-muted" style="font-size: 12px;">已选 {{ batchSelected.size }} 人</span>
        <span class="flex-1"></span>
        <select v-model="targetGroupId" class="input select" style="width: 130px;">
          <option v-for="g in targetOptions" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
        <button class="btn btn--sm" :disabled="batchSelected.size === 0" @click="onStoreSelected">存入名册</button>
        <button class="btn btn--sm btn--danger" :disabled="batchSelected.size === 0" @click="onDeleteSelected">删除</button>
      </div>

      <div v-if="addOpen" class="add-area">
        <InputPanel />
      </div>

      <div v-if="currentEntries.length === 0" class="empty">还没有人，点「＋ 添加」，或从顶部「名册」取用</div>
      <div v-else class="chip-list">
        <NameChip
          v-for="e in currentEntries"
          :key="e.uid"
          :name="e.name"
          :picked="e.pickedThisSession"
          :blocked="isBlack(e.name)"
          :selectable="batchMode"
          :checked="batchSelected.has(e.uid)"
          :accent="accentOf(e.uid)"
          :marks="marksOf(e.uid)"
          @check="toggleSelect(e.uid)"
          @rename="onRenameCurrent(e)"
          @contextmenu.prevent="onRenameCurrent(e)"
        />
      </div>
    </section>
  </div>
</template>
