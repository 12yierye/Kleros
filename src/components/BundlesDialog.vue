<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUi } from '@/composables/useUi'
import { useBundles } from '@/composables/useBundles'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { BINDING_GROUP_COLORS } from '@/constants'
import type { Bundle } from '@/types/bundle'

const ui = useUi()
const rel = useBundles()
const roster = useRoster()
const lib = usePermanentRoster()

const isOpen = ref(false)
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const name = ref('')
const color = ref<string>(BINDING_GROUP_COLORS[0])
const selected = ref<Set<string>>(new Set())

watch(() => ui.state.modal, (v) => {
  const open = v === 'bundles'
  isOpen.value = open
  if (open) resetEditor()
}, { immediate: true })

const list = computed(() => [...rel.all.value].sort((a, b) => a.createdAt - b.createdAt))

const currentItems = computed(() =>
  roster.entries.value.map(e => ({ uid: e.uid, name: e.name }))
)

const bookItems = computed(() =>
  lib.groups.value
    .map(g => ({
      id: g.id,
      name: g.name,
      items: g.members.map(m => ({ uid: m.uid, name: m.name })),
    }))
    .filter(g => g.items.length > 0)
)

const nameOfMap = computed(() => {
  const m = new Map<string, string>()
  for (const it of currentItems.value) m.set(it.uid, it.name)
  for (const g of bookItems.value) for (const it of g.items) m.set(it.uid, it.name)
  return m
})

const nameOf = (uid: string) => nameOfMap.value.get(uid) ?? uid.slice(-6)

const canSave = computed(() => selected.value.size >= 2 && name.value.trim().length > 0)

function resetEditor() {
  editingId.value = null
  editorOpen.value = false
  name.value = ''
  color.value = BINDING_GROUP_COLORS[0]
  selected.value = new Set()
}

function close() {
  ui.closeModal()
}

function startNew() {
  resetEditor()
  editorOpen.value = true
  focusEditor()
}

function startEdit(g: Bundle) {
  editingId.value = g.id
  editorOpen.value = true
  name.value = g.name
  color.value = g.color
  selected.value = new Set(g.members.map(m => m.uid))
  focusEditor()
}

function focusEditor() {
  void nextTick(() => {
    document.getElementById('bundle-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function toggle(uid: string) {
  const s = new Set(selected.value)
  if (s.has(uid)) s.delete(uid)
  else s.add(uid)
  selected.value = s
}

function selectAll(uids: string[]) {
  const s = new Set(selected.value)
  const all = uids.every(u => s.has(u))
  for (const u of uids) {
    if (all) s.delete(u)
    else s.add(u)
  }
  selected.value = s
}

function clearSelection() {
  selected.value = new Set()
}

function removeMember(g: Bundle, uid: string) {
  rel.removeMembers(g.id, [uid])
  if (editingId.value === g.id) {
    const s = new Set(selected.value)
    s.delete(uid)
    selected.value = s
  }
}

function dissolve(g: Bundle) {
  rel.dissolve(g.id)
  if (editingId.value === g.id) resetEditor()
}

function save() {
  if (!canSave.value) return
  const uids = [...selected.value]

  if (editingId.value) {
    const target = rel.all.value.find(r => r.id === editingId.value)
    if (!target) { resetEditor(); return }
    rel.rename(target.id, name.value)
    rel.recolor(target.id, color.value)
    const existing = new Set(target.members.map(m => m.uid))
    const toRemove = [...existing].filter(u => !uids.includes(u))
    const toAdd = uids.filter(u => !existing.has(u))
    if (toRemove.length > 0) rel.removeMembers(target.id, toRemove)
    if (toAdd.length > 0) rel.addMembers(target.id, toAdd)
  } else {
    rel.create({ name: name.value, color: color.value, memberUids: uids })
  }
  resetEditor()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @click.self="close">
      <div class="modal modal--wide">
        <div class="modal__header">
          <span>绑定小组</span>
          <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal__body">
          <p class="modal-lead">同一小组里的人会一起被抽中，不会被拆开。</p>

          <div v-if="list.length === 0 && !editorOpen" class="empty" style="padding: 10px 0 14px;">
            还没有小组
          </div>

          <div v-else-if="list.length > 0" class="rel-list">
            <div
              v-for="g in list"
              :key="g.id"
              class="rel-card"
              :class="{ 'rel-card--editing': editingId === g.id }"
            >
              <div class="rel-card__head">
                <span class="rel-card__dot" :style="{ background: g.color }"></span>
                <b class="rel-card__name">{{ g.name }}</b>
                <span class="rel-card__count">{{ g.members.length }} 人</span>
                <span class="flex-1"></span>
                <button class="btn btn--ghost rel-card__btn" @click="startEdit(g)">编辑</button>
                <button class="btn btn--ghost rel-card__btn" @click="dissolve(g)">拆散</button>
              </div>
              <div class="rel-card__members">
                <span v-for="m in g.members" :key="m.uid" class="rel-member">
                  <span class="rel-member__name">{{ nameOf(m.uid) }}</span>
                  <button class="rel-member__remove" title="移除" @click="removeMember(g, m.uid)">×</button>
                </span>
              </div>
            </div>
          </div>

          <div v-if="!editorOpen" style="margin-top: 14px;">
            <button class="btn btn--primary" @click="startNew">＋ 新建小组</button>
          </div>

          <div v-else id="bundle-editor" class="rel-editor">
            <div class="rel-editor__head">
              <b>{{ editingId ? '编辑小组' : '新建小组' }}</b>
              <span class="text-subtle" style="font-size: 11px;">至少 2 人 · 已选 {{ selected.size }}</span>
              <span class="flex-1"></span>
              <button class="btn btn--sm" @click="resetEditor">取消</button>
            </div>

            <div class="field">
              <label class="field__label">名称</label>
              <input v-model="name" class="input" placeholder="例如：双人搭档" style="max-width: 260px;" />
            </div>

            <div class="field">
              <label class="field__label">颜色</label>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button
                  v-for="c in BINDING_GROUP_COLORS"
                  :key="c"
                  type="button"
                  class="rel-swatch"
                  :class="{ 'rel-swatch--active': color === c }"
                  :style="{ background: c }"
                  :aria-label="`颜色 ${c}`"
                  @click="color = c"
                ></button>
              </div>
            </div>

            <div class="field">
              <label class="field__label">成员</label>

              <div v-if="currentItems.length === 0 && bookItems.length === 0" class="empty" style="padding: 8px 0;">
                当前名单和名册里都还没有人
              </div>

              <div v-else class="rel-picker">
                <div v-if="currentItems.length > 0" class="rel-source">
                  <div class="rel-source__head">
                    <span>当前名单（{{ currentItems.length }}）</span>
                    <button class="btn btn--ghost btn--xs" @click="selectAll(currentItems.map(i => i.uid))">全选</button>
                  </div>
                  <div class="chip-list">
                    <label
                      v-for="m in currentItems"
                      :key="m.uid"
                      class="pick-chip"
                      :class="{ 'pick-chip--on': selected.has(m.uid) }"
                    >
                      <input type="checkbox" :checked="selected.has(m.uid)" @change="toggle(m.uid)" />
                      <span class="ellipsis">{{ m.name }}</span>
                    </label>
                  </div>
                </div>

                <div v-for="bk in bookItems" :key="bk.id" class="rel-source">
                  <div class="rel-source__head">
                    <span>名册 · {{ bk.name }}（{{ bk.items.length }}）</span>
                    <button class="btn btn--ghost btn--xs" @click="selectAll(bk.items.map(i => i.uid))">整册选</button>
                  </div>
                  <div class="chip-list">
                    <label
                      v-for="m in bk.items"
                      :key="m.uid"
                      class="pick-chip"
                      :class="{ 'pick-chip--on': selected.has(m.uid) }"
                    >
                      <input type="checkbox" :checked="selected.has(m.uid)" @change="toggle(m.uid)" />
                      <span class="ellipsis">{{ m.name }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="rel-editor__actions">
                <button class="btn btn--sm" :disabled="selected.size === 0" @click="clearSelection">清空选择</button>
                <span class="flex-1"></span>
                <button class="btn btn--sm btn--primary" :disabled="!canSave" @click="save">
                  {{ editingId ? '保存' : '创建' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal__footer">
          <button class="btn btn--primary" @click="close">完成</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.rel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rel-card {
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-bg);
  overflow: hidden;
}

.rel-card--editing {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.rel-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
}

.rel-card__dot {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.rel-card__name {
  font-size: var(--fs-sm);
}

.rel-card__count {
  font-size: 11px;
  color: var(--color-text-muted);
}

.rel-card__btn {
  font-size: 11px;
  padding: 2px 8px;
  color: var(--color-text-muted);
}

.rel-card__members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 10px 8px 29px;
}

.rel-member {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--r-full);
  background: var(--color-bg-elev);
  font-size: 12px;
}

.rel-member__name {
  color: var(--color-text);
}

.rel-member__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: var(--color-text-subtle);
  font-size: 11px;
  line-height: 1;
}

.rel-member__remove:hover {
  background: var(--color-chip-bg-hover);
  color: var(--color-text);
}

.rel-editor {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}

.rel-editor__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.rel-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  transition: transform 0.1s, border-color 0.15s;
}

.rel-swatch:hover {
  transform: scale(1.1);
}

.rel-swatch--active {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg) inset;
}

.rel-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  padding: 10px;
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rel-source__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--color-text-subtle);
}

.rel-editor__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
</style>
