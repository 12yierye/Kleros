<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { useBindingGroups } from '@/composables/useBindingGroups'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { BINDING_GROUP_COLORS } from '@/constants'
import type { BindingGroup } from '@/types/binding'

const ui = useUi()
const bg = useBindingGroups()
const roster = useRoster()
const permanent = usePermanentRoster()

const isOpen = ref(false)
const editingId = ref<string | null>(null)
const newName = ref('')
const newColor = ref<string>(BINDING_GROUP_COLORS[0])
const selectedUids = ref<Set<string>>(new Set())

watch(() => ui.state.modal, (v) => {
  const open = v === 'bindingGroups'
  isOpen.value = open
  if (open) resetEditor()
}, { immediate: true })

function resetEditor() {
  editingId.value = null
  newName.value = ''
  newColor.value = BINDING_GROUP_COLORS[0]
  selectedUids.value = new Set()
}

function close() {
  ui.closeModal()
}

function onBackdrop() {
  close()
}

function startEditGroup(g: BindingGroup) {
  editingId.value = g.id
  newName.value = g.name
  newColor.value = g.color
  selectedUids.value = new Set(g.members.map(m => m.uid))
  const el = document.getElementById('binding-group-editor')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function startNewGroup() {
  resetEditor()
  const el = document.getElementById('binding-group-editor')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function toggleMember(uid: string) {
  const s = new Set(selectedUids.value)
  if (s.has(uid)) s.delete(uid)
  else s.add(uid)
  selectedUids.value = s
}

function addWholeRoster(groupId: string) {
  const items = roster.entries.value
    .filter(e => e.groupId === groupId)
    .map(e => e.uid)
  const s = new Set(selectedUids.value)
  for (const u of items) s.add(u)
  selectedUids.value = s
}

function addAllPermanent() {
  const s = new Set(selectedUids.value)
  for (const e of permanent.entries.value) s.add(e.uid)
  selectedUids.value = s
}

function removeMemberFromGroup(g: BindingGroup, uid: string) {
  bg.removeMembers(g.id, [uid])
}

function confirmEdit() {
  if (selectedUids.value.size < 2) return
  if (editingId.value) {
    const g = bg.groups.value.find(x => x.id === editingId.value)
    if (g) {
      bg.rename(g.id, newName.value)
      bg.recolor(g.id, newColor.value)
      const existingUids = new Set(g.members.map(m => m.uid))
      const toRemove = [...existingUids].filter(u => !selectedUids.value.has(u))
      const toAdd = [...selectedUids.value].filter(u => !existingUids.has(u))
      if (toRemove.length > 0) bg.removeMembers(g.id, toRemove)
      if (toAdd.length > 0) bg.addMembers(g.id, toAdd)
    }
  } else {
    bg.create({ name: newName.value, color: newColor.value, memberUids: [...selectedUids.value] })
  }
  resetEditor()
}

function dissolveGroup(g: BindingGroup) {
  bg.dissolve(g.id)
  if (editingId.value === g.id) resetEditor()
}

const nameOf = (uid: string) => {
  const r = roster.entries.value.find(e => e.uid === uid)
  if (r) return r.name
  const p = permanent.entries.value.find(e => e.uid === uid)
  if (p) return p.name
  return uid.slice(-6)
}

const rosterByGroup = computed(() => {
  const out: { groupId: string; groupName: string; items: { uid: string; name: string }[] }[] = []
  for (const g of roster.groups.value) {
    const items = roster.entries.value
      .filter(e => e.groupId === g.id)
      .map(e => ({ uid: e.uid, name: e.name }))
    if (items.length > 0) {
      out.push({ groupId: g.id, groupName: g.name, items })
    }
  }
  return out
})

const permanentItems = computed(() =>
  permanent.entries.value.map(e => ({ uid: e.uid, name: e.name }))
)

const isConfirmDisabled = computed(() =>
  selectedUids.value.size < 2 || newName.value.trim() === ''
)

const sortedGroups = computed(() =>
  [...bg.groups.value].sort((a, b) => a.createdAt - b.createdAt)
)
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @click.self="onBackdrop">
      <div class="modal modal--wide" @click.stop>
        <div class="modal__header">
          <span>互斥组</span>
        </div>

        <div class="modal__body">
          <div v-if="sortedGroups.length === 0" class="empty" style="padding: 12px 0;">
            还没有互斥组。点击下方「+ 新建组」创建。
          </div>

          <div v-else style="display: flex; flex-direction: column; gap: 10px;">
            <div
              v-for="g in sortedGroups"
              :key="g.id"
              class="bg-card"
              :class="{ 'bg-card--editing': editingId === g.id }"
            >
              <div class="bg-card__head" @click="startEditGroup(g)">
                <span class="bg-card__dot" :style="{ background: g.color }"></span>
                <b class="bg-card__name">{{ g.name }}</b>
                <span class="bg-card__count">{{ g.members.length }} 人</span>
                <span class="bg-card__spacer"></span>
                <button
                  class="btn btn--ghost btn--danger"
                  style="font-size: 11px; padding: 3px 8px;"
                  @click.stop="dissolveGroup(g)"
                >拆散</button>
              </div>
              <div class="bg-card__members">
                <span
                  v-for="m in g.members"
                  :key="m.uid"
                  class="bg-card__member"
                >
                  <span class="bg-card__member-name">{{ nameOf(m.uid) }}</span>
                  <button
                    class="bg-card__member-remove"
                    title="移除"
                    @click="removeMemberFromGroup(g, m.uid)"
                  >×</button>
                </span>
              </div>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid var(--color-border); margin: 16px 0;" />

          <div id="binding-group-editor" class="bg-editor">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <b>{{ editingId ? '编辑组' : '新建组' }}</b>
              <button
                v-if="!editingId"
                class="btn"
                style="font-size: 12px; padding: 4px 10px;"
                @click="startNewGroup"
              >+ 新建组</button>
              <button
                v-else
                class="btn"
                style="font-size: 12px; padding: 4px 10px;"
                @click="resetEditor"
              >取消编辑</button>
            </div>

            <div class="field">
              <label class="field__label">组名</label>
              <input
                v-model="newName"
                class="input"
                placeholder="例如：张三家"
                style="max-width: 280px;"
              />
            </div>

            <div class="field">
              <label class="field__label">颜色</label>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button
                  v-for="c in BINDING_GROUP_COLORS"
                  :key="c"
                  type="button"
                  class="bg-swatch"
                  :class="{ 'bg-swatch--active': newColor === c }"
                  :style="{ background: c }"
                  :aria-label="`颜色 ${c}`"
                  @click="newColor = c"
                ></button>
              </div>
            </div>

            <div class="field">
              <label class="field__label">成员（至少 2 人）</label>
              <div v-if="rosterByGroup.length === 0 && permanentItems.length === 0" class="empty" style="padding: 8px 0;">
                当前会话没有可绑定的成员
              </div>
              <div v-else style="display: flex; flex-direction: column; gap: 8px;">
                <div v-for="g in rosterByGroup" :key="g.groupId">
                  <div class="bg-roster-header">
                    <span class="text-muted" style="font-size: 11px;">
                      {{ g.groupName }}（{{ g.items.length }}）
                    </span>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      style="font-size: 11px; padding: 1px 6px;"
                      @click="addWholeRoster(g.groupId)"
                    >+ 整名单</button>
                  </div>
                  <div class="chip-list">
                    <label
                      v-for="m in g.items"
                      :key="m.uid"
                      class="bg-member"
                      :class="{ 'bg-member--checked': selectedUids.has(m.uid) }"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedUids.has(m.uid)"
                        @change="toggleMember(m.uid)"
                      />
                      <span>{{ m.name }}</span>
                    </label>
                  </div>
                </div>
                <div v-if="permanentItems.length > 0">
                  <div class="bg-roster-header">
                    <span class="text-muted" style="font-size: 11px;">
                      常驻（{{ permanentItems.length }}）
                    </span>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      style="font-size: 11px; padding: 1px 6px;"
                      @click="addAllPermanent"
                    >+ 全部加入</button>
                  </div>
                  <div class="chip-list">
                    <label
                      v-for="m in permanentItems"
                      :key="m.uid"
                      class="bg-member"
                      :class="{ 'bg-member--checked': selectedUids.has(m.uid) }"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedUids.has(m.uid)"
                        @change="toggleMember(m.uid)"
                      />
                      <span>{{ m.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal__footer">
          <button
            class="btn btn--primary"
            :disabled="isConfirmDisabled"
            @click="confirmEdit"
          >{{ editingId ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.bg-card {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-elev);
  overflow: hidden;
}
.bg-card--editing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}
.bg-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}
.bg-card__head:hover {
  background: var(--color-chip-bg-hover);
}
.bg-card__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
.bg-card__name {
  font-size: 13px;
}
.bg-card__count {
  font-size: 11px;
  color: var(--color-text-muted);
}
.bg-card__spacer {
  flex: 1 1 auto;
}
.bg-card__members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 10px 8px 30px;
}
.bg-card__member {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  background: var(--color-bg-sunken);
  border-radius: var(--r-full);
  font-size: 12px;
  border: 1px solid var(--color-border);
}
.bg-card__member-name {
  color: var(--color-text);
}
.bg-card__member-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1;
  background: transparent;
  border: none;
  cursor: pointer;
}
.bg-card__member-remove:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-text);
}

.bg-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  outline: none;
  transition: transform 0.1s, border-color 0.15s;
}
.bg-swatch:hover {
  transform: scale(1.1);
}
.bg-swatch--active {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg-elev) inset;
}

.bg-roster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.bg-member {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--color-bg-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--r-full);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s, border-color 0.1s;
}
.bg-member--checked {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}
.bg-member input {
  margin: 0;
  width: 12px;
  height: 12px;
  accent-color: var(--color-primary);
}
</style>
