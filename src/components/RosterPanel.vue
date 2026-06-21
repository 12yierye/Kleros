<script setup lang="ts">
import { ref } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useUi } from '@/composables/useUi'
import NameChip from './NameChip.vue'
import type { RosterEntry, PermanentEntry } from '@/types/roster'

const { entries: roster, clear: clearRoster, promoteAllToPermanent, promoteToPermanent } = useRoster()
const { entries: permanent, add: addPermanent, remove: removePermanent } = usePermanentRoster()
const { isBlack } = useBlackWhiteList()
const ui = useUi()

const permanentInput = ref('')

function onPromoteAll() {
  void ui.askConfirm({
    title: '全部移入常驻？',
    message: '临时名单将被清空，所有成员进入常驻名单。',
    confirmText: '全部移入',
  }).then(ok => {
    if (!ok) return
    const snap = promoteAllToPermanent()
    usePermanentRoster().entries.value.push(...snap) // 直接 import via composable
  })
}

function onClearRoster() {
  if (roster.value.length === 0) return
  void ui.askConfirm({
    title: '清空临时名单？',
    message: '此操作不影响常驻名单。',
    danger: true,
    confirmText: '清空',
  }).then(ok => {
    if (ok) clearRoster()
  })
}

function onPromoteOne(entry: RosterEntry) {
  const snap = promoteToPermanent(entry.uid)
  if (snap) {
    usePermanentRoster().entries.value.push({
      uid: snap.uid,
      name: snap.name,
      addedAt: snap.addedAt,
    })
  }
}

function onAddPermanent() {
  const v = permanentInput.value.trim()
  if (!v) return
  if (addPermanent(v)) permanentInput.value = ''
}

function onRemovePermanent(e: PermanentEntry) {
  void ui.askConfirm({
    title: `从常驻移除 “${e.name}”？`,
    message: '常驻名单中将不再包含此人。',
    danger: true,
    confirmText: '移除',
  }).then(ok => {
    if (ok) removePermanent(e.uid)
  })
}

function rosterCtx(entry: RosterEntry) {
  ui.openRename(entry.uid, 'roster')
}

function permanentCtx(entry: PermanentEntry) {
  ui.openRename(entry.uid, 'permanent')
}
</script>

<template>
  <section class="main-section">
    <div class="main-section__title">
      <span>名单</span>
    </div>

    <!-- 临时名单 -->
    <div style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div>
          <b>临时名单</b>
          <span class="text-muted" style="font-size: 12px; margin-left: 6px;">({{ roster.length }})</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button
            class="btn"
            @click="onPromoteAll"
            :disabled="roster.length === 0"
            title="把临时名单中所有人转入常驻"
          >→ 全部转常驻</button>
          <button
            class="btn btn--danger"
            @click="onClearRoster"
            :disabled="roster.length === 0"
          >清空</button>
        </div>
      </div>
      <div v-if="roster.length === 0" class="empty">还没有临时名单，请在「数据输入」添加</div>
      <div v-else class="chip-list">
        <NameChip
          v-for="e in roster"
          :key="e.uid"
          :name="e.name"
          :picked="e.pickedThisSession"
          :blocked="isBlack(e.name)"
          @contextmenu.prevent="rosterCtx(e)"
          @rename="rosterCtx(e)"
          @promote="onPromoteOne(e)"
        />
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid var(--color-border); margin: 16px 0;" />

    <!-- 常驻名单 -->
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div>
          <b>常驻名单</b>
          <span class="text-muted" style="font-size: 12px; margin-left: 6px;">({{ permanent.length }})</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <input
            v-model="permanentInput"
            class="input"
            placeholder="加入常驻"
            @keyup.enter="onAddPermanent"
            style="width: 160px;"
          />
          <button class="btn" @click="onAddPermanent" :disabled="!permanentInput.trim()">+ 添加</button>
        </div>
      </div>
      <div v-if="permanent.length === 0" class="empty">还没有常驻成员</div>
      <div v-else class="chip-list">
        <NameChip
          v-for="e in permanent"
          :key="e.uid"
          :name="e.name"
          :closable="true"
          @close="onRemovePermanent(e)"
          @contextmenu.prevent="permanentCtx(e)"
          @rename="permanentCtx(e)"
        />
      </div>
    </div>
  </section>
</template>
