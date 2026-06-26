<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useBindingGroups } from '@/composables/useBindingGroups'
import { useUi } from '@/composables/useUi'
import NameChip from './NameChip.vue'
import type { RosterEntry, PermanentEntry } from '@/types/roster'
import type { BindingGroup } from '@/types/binding'

const roster = useRoster()
const { entries: permanent, add: addPermanent, remove: removePermanent } = usePermanentRoster()
const { isBlack } = useBlackWhiteList()
const bindingGroups = useBindingGroups()
const ui = useUi()

function openBindingGroups() {
  ui.openModal('bindingGroups')
}

function groupsForUidOrdered(uid: string): BindingGroup[] {
  return bindingGroups.getGroupsForUidByAddedAt(uid)
}

/**
 * 若该 roster 的所有当前 uid 都被纳入同一组 G，返回 G；否则返回 null
 * 多个 G 同时满足时取 createdAt 最早的
 */
function groupForRosterAllMembers(rosterGroupId: string): BindingGroup | null {
  const uids = roster.entries.value.filter(e => e.groupId === rosterGroupId).map(e => e.uid)
  if (uids.length === 0) return null
  const candidates = bindingGroups.groups.value.filter(g => {
    const memberSet = new Set(g.members.map(m => m.uid))
    return uids.every(u => memberSet.has(u))
  })
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => a.createdAt - b.createdAt)[0]
}

const permanentInput = ref('')

const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')

const batchGroupId = ref<string | null>(null)
const batchSelected = ref<Set<string>>(new Set())

function startEditGroup(id: string, currentName: string) {
  editingGroupId.value = id
  editingGroupName.value = currentName
}

function confirmEditGroup() {
  const name = editingGroupName.value.trim()
  if (name && editingGroupId.value) {
    roster.renameGroup(editingGroupId.value, name)
  }
  editingGroupId.value = null
  editingGroupName.value = ''
}

function cancelEditGroup() {
  editingGroupId.value = null
  editingGroupName.value = ''
}

function onDeleteGroup(id: string, name: string) {
  void ui.askConfirm({
    title: `删除 "${name}"？`,
    message: '将删除该分组中的所有条目。',
    danger: true,
    confirmText: '删除',
  }).then(ok => {
    if (ok) roster.deleteGroup(id)
  })
}

function enterBatchMode(groupId: string) {
  batchGroupId.value = groupId
  batchSelected.value = new Set()
}

function exitBatchMode() {
  batchGroupId.value = null
  batchSelected.value = new Set()
}

function toggleBatchSelect(uid: string) {
  const s = new Set(batchSelected.value)
  if (s.has(uid)) s.delete(uid)
  else s.add(uid)
  batchSelected.value = s
}

const batchCount = computed(() => batchSelected.value.size)

function onBatchRename() {
  if (batchCount.value !== 1) return
  const uid = [...batchSelected.value][0]
  const e = roster.entries.value.find(x => x.uid === uid)
  if (e) {
    ui.openRename(uid, 'roster')
  }
  exitBatchMode()
}

function onBatchDelete() {
  if (batchCount.value === 0) return
  void ui.askConfirm({
    title: `删除 ${batchCount.value} 人？`,
    message: '将从当前分组中移除这些人。',
    danger: true,
    confirmText: '删除',
  }).then(ok => {
    if (ok) {
      roster.deleteEntries([...batchSelected.value])
      exitBatchMode()
    }
  })
}

function onBatchPromote() {
  if (batchCount.value === 0) return
  void ui.askConfirm({
    title: `将 ${batchCount.value} 人转入常驻？`,
    message: '选中的条目将从临时名单移除并加入常驻名单。',
    confirmText: '转入常驻',
  }).then(ok => {
    if (ok) {
      const snap = roster.promoteEntries([...batchSelected.value])
      for (const s of snap) {
        if (!permanent.value.find(p => p.uid === s.uid)) {
          permanent.value.push(s)
        }
      }
      exitBatchMode()
    }
  })
}

const showTransfer = ref(false)

function onBatchTransfer(targetGroupId: string) {
  if (batchCount.value === 0) return
  roster.moveToGroup([...batchSelected.value], targetGroupId)
  exitBatchMode()
  showTransfer.value = false
}

const otherGroups = computed(() =>
  roster.groups.value.filter(g => g.id !== batchGroupId.value)
)

function onPromoteOne(entry: RosterEntry) {
  const snap = roster.promoteToPermanent(entry.uid)
  if (snap) {
    permanent.value.push({
      uid: snap.uid,
      name: snap.name,
      addedAt: snap.addedAt,
    })
  }
}

function onClearGroup(groupId: string) {
  const current = roster.entries.value.filter(e => e.groupId === groupId)
  if (current.length === 0) return
  void ui.askConfirm({
    title: '清空当前分组？',
    message: '此操作不影响常驻名单和其他分组。',
    danger: true,
    confirmText: '清空',
  }).then(ok => {
    if (ok) roster.clearGroup(groupId)
  })
}

function onAddPermanent() {
  const v = permanentInput.value.trim()
  if (!v) return
  if (addPermanent(v)) permanentInput.value = ''
}

function onRemovePermanent(e: PermanentEntry) {
  void ui.askConfirm({
    title: `从常驻移除 "${e.name}"？`,
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

    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border);">
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
        <input type="checkbox" v-model="roster.crossGroup.value" />
        我全都要
      </label>
      <span style="flex: 1 1 auto;"></span>
      <button
        class="btn"
        style="font-size: 12px; padding: 4px 10px;"
        @click="openBindingGroups"
        :title="`已建 ${bindingGroups.groups.value.length} 个互斥组`"
      >
        互斥组{{ bindingGroups.groups.value.length > 0 ? ` (${bindingGroups.groups.value.length})` : '' }}
      </button>
    </div>

    <template v-for="(group, gi) in roster.groups.value" :key="group.id">
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <template v-if="editingGroupId === group.id">
              <input
                v-model="editingGroupName"
                class="input"
                style="width: 160px; font-weight: 600;"
                @keyup.enter="confirmEditGroup"
                @keyup.escape="cancelEditGroup"
              />
              <button class="btn btn--ghost" style="font-size: 12px; padding: 2px 6px;" @click="confirmEditGroup">✓</button>
              <button class="btn btn--ghost" style="font-size: 12px; padding: 2px 6px;" @click="cancelEditGroup">✕</button>
            </template>
            <template v-else>
              <b :style="{ color: roster.activeGroupId.value === group.id ? 'var(--color-primary)' : 'inherit', cursor: 'pointer' }" @click="roster.setActiveGroup(group.id)">{{ group.name }}</b>
              <span
                v-if="groupForRosterAllMembers(group.id)"
                class="bg-dot bg-dot--inline"
              >
                <span class="bg-dot__ball" :style="{ background: groupForRosterAllMembers(group.id)!.color }"></span>
                <span class="bg-dot__tip" role="tooltip">
                  <span class="bg-dot__tip-swatch" :style="{ background: groupForRosterAllMembers(group.id)!.color }"></span>
                  <span>{{ groupForRosterAllMembers(group.id)!.name }}</span>
                </span>
              </span>
              <span class="text-muted" style="font-size: 12px;">({{ roster.entries.value.filter(e => e.groupId === group.id).length }})</span>
            </template>
          </div>
          <div style="display: flex; gap: 4px;">
            <template v-if="editingGroupId !== group.id">
              <button
                class="btn btn--ghost"
                style="font-size: 12px; padding: 2px 6px;"
                title="重命名"
                @click="startEditGroup(group.id, group.name)"
              >✏️</button>
              <button
                v-if="gi > 0"
                class="btn btn--ghost btn--danger"
                style="font-size: 12px; padding: 2px 6px;"
                title="删除"
                @click="onDeleteGroup(group.id, group.name)"
              >🗑</button>
            </template>
          </div>
        </div>

        <div v-if="batchGroupId !== group.id" style="display: flex; gap: 6px; margin-bottom: 6px;">
          <button
            class="btn btn--ghost"
            style="font-size: 12px; padding: 4px 10px;"
            @click="enterBatchMode(group.id)"
            :disabled="roster.entries.value.filter(e => e.groupId === group.id).length === 0"
          >批量操作</button>
          <button
            class="btn btn--ghost btn--danger"
            style="font-size: 12px; padding: 4px 10px;"
            @click="onClearGroup(group.id)"
            :disabled="roster.entries.value.filter(e => e.groupId === group.id).length === 0"
          >清空</button>
        </div>

        <div v-else style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
          <button class="btn btn--ghost" style="font-size: 11px; padding: 3px 8px;" @click="exitBatchMode">取消</button>
          <button class="btn btn--ghost" style="font-size: 11px; padding: 3px 8px;" :disabled="batchCount !== 1" @click="onBatchRename">重命名</button>
          <button class="btn btn--danger" style="font-size: 11px; padding: 3px 8px;" :disabled="batchCount === 0" @click="onBatchDelete">删除 ({{ batchCount }})</button>
          <button class="btn btn--ghost" style="font-size: 11px; padding: 3px 8px;" :disabled="batchCount === 0" @click="onBatchPromote">转常驻 ({{ batchCount }})</button>
          <div style="position: relative;">
            <button class="btn btn--ghost" style="font-size: 11px; padding: 3px 8px;" :disabled="batchCount === 0 || otherGroups.length === 0" @click="showTransfer = !showTransfer">转到 ▾</button>
            <div v-if="showTransfer && otherGroups.length > 0" style="position: absolute; top: 100%; left: 0; margin-top: 2px; background: var(--color-bg); border: 1px solid var(--color-border-strong); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 50; min-width: 120px;">
              <button
                v-for="g in otherGroups" :key="g.id"
                class="btn btn--ghost"
                style="display: block; width: 100%; text-align: left; font-size: 12px; padding: 4px 10px; border-radius: 0;"
                @click="onBatchTransfer(g.id)"
              >{{ g.name }}</button>
            </div>
          </div>
        </div>

        <div v-if="roster.entries.value.filter(e => e.groupId === group.id).length === 0" class="empty">此分组还没有成员</div>
        <div v-else class="chip-list">
          <div
            v-for="e in roster.entries.value.filter(e => e.groupId === group.id)"
            :key="e.uid"
            class="chip-item"
          >
            <NameChip
              :name="e.name"
              :picked="e.pickedThisSession"
              :blocked="isBlack(e.name)"
              :selectable="batchGroupId === group.id"
              :checked="batchSelected.has(e.uid)"
              @contextmenu.prevent="rosterCtx(e)"
              @rename="rosterCtx(e)"
              @promote="onPromoteOne(e)"
              @check="toggleBatchSelect(e.uid)"
            />
            <span
              v-for="g in groupsForUidOrdered(e.uid)"
              :key="g.id"
              class="bg-dot"
            >
              <span class="bg-dot__ball" :style="{ background: g.color }"></span>
              <span class="bg-dot__tip" role="tooltip">
                <span class="bg-dot__tip-swatch" :style="{ background: g.color }"></span>
                <span>{{ g.name }}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
      <hr v-if="gi < roster.groups.value.length - 1" style="border: none; border-top: 1px solid var(--color-border); margin: 0 0 16px 0;" />
    </template>

    <hr style="border: none; border-top: 1px solid var(--color-border); margin: 16px 0;" />

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
