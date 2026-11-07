<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUi } from '@/composables/useUi'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useModalHeight } from '@/composables/useModalHeight'
import { matchName } from '@/utils/pinyin'
import type { PermanentGroup, PermanentEntry } from '@/types/roster'

const ui = useUi()
const lib = usePermanentRoster()
const roster = useRoster()

const modalRef = ref<HTMLElement | null>(null)
const { animateHeight } = useModalHeight(modalRef)

const isOpen = ref(false)
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const name = ref('')
const keyword = ref('')
const picked = ref<Set<string>>(new Set())
const notice = ref('')

watch(() => ui.state.modal, (v) => {
  const open = v === 'library'
  isOpen.value = open
  if (open) {
    resetEditor()
    notice.value = ''
  }
}, { immediate: true })

const groups = computed(() => lib.groups.value)

/** 可选的成员来源：当前名单 + 其他名册 */
const sources = computed(() => {
  const out: { label: string; items: string[] }[] = []
  const current = roster.entries.value.map(e => e.name)
  if (current.length > 0) out.push({ label: '当前名单', items: current })
  for (const g of lib.groups.value) {
    if (editingId.value && g.id === editingId.value) continue
    const items = g.members.map(m => m.name)
    if (items.length > 0) out.push({ label: `名册 · ${g.name}`, items })
  }
  return out
})

const filteredSources = computed(() => {
  const kw = keyword.value.trim()
  return sources.value
    .map(s => ({ label: s.label, items: s.items.filter(n => matchName(n, kw)) }))
    .filter(s => s.items.length > 0)
})

const totalAvailable = computed(() => new Set(sources.value.flatMap(s => s.items)).size)
const canSave = computed(() => name.value.trim().length > 0 && picked.value.size > 0)

function resetEditor() {
  editorOpen.value = false
  editingId.value = null
  name.value = ''
  keyword.value = ''
  picked.value = new Set()
}

function say(text: string) {
  notice.value = text
}

function close() {
  ui.closeModal()
}

function startNew() {
  void animateHeight(() => {
    resetEditor()
    editorOpen.value = true
  })
  focusEditor()
}

function startEdit(g: PermanentGroup) {
  void animateHeight(() => {
    editingId.value = g.id
    editorOpen.value = true
    name.value = g.name
    keyword.value = ''
    picked.value = new Set(g.members.map(m => m.name))
  })
  focusEditor()
}

function onCancel() {
  void animateHeight(resetEditor)
}

function focusEditor() {
  void nextTick(() => {
    document.getElementById('lib-group-name')?.focus()
  })
}

function toggle(n: string) {
  const s = new Set(picked.value)
  if (s.has(n)) s.delete(n)
  else s.add(n)
  picked.value = s
}

function toggleSource(items: string[]) {
  const s = new Set(picked.value)
  const all = items.every(n => s.has(n))
  for (const n of items) {
    if (all) s.delete(n)
    else s.add(n)
  }
  picked.value = s
}

function clearAll() {
  picked.value = new Set()
}

function save() {
  if (!canSave.value) return
  const names = [...picked.value]
  if (editingId.value) {
    const g = lib.groups.value.find(x => x.id === editingId.value)
    if (!g) { resetEditor(); return }
    lib.renameGroup(g.id, name.value.trim())
    lib.setMembers(g.id, names)
    say(`已保存「${name.value.trim()}」`)
  } else {
    const id = lib.addGroup(name.value.trim())
    lib.setMembers(id, names)
    say(`已创建「${name.value.trim()}」`)
  }
  void animateHeight(resetEditor)
}

function onDeleteGroup(g: PermanentGroup) {
  if (g.members.length === 0) {
    lib.deleteGroup(g.id)
    say('已删除空名册')
    if (editingId.value === g.id) resetEditor()
    return
  }
  void ui.askConfirm({
    title: `删除「${g.name}」？`,
    message: `册内 ${g.members.length} 人将一并删除，当前名单不受影响。`,
    danger: true,
    confirmText: '删除',
  }).then(ok => {
    if (!ok) return
    lib.deleteGroup(g.id)
    if (editingId.value === g.id) resetEditor()
    say(`已删除「${g.name}」`)
  })
}

function onRemoveMember(g: PermanentGroup, m: PermanentEntry) {
  lib.removeMember(g.id, m.uid)
}
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-backdrop" @click.self="close">
      <div ref="modalRef" class="modal modal--wide">
        <div class="modal__header">
          <span>{{ editorOpen ? (editingId ? '编辑名册' : '新建名册') : '名册' }}</span>
          <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal__body">
          <!-- 列表视图 -->
          <template v-if="!editorOpen">
            <p class="modal-lead">长期保存的名单。需要时在名单页的「从名册」里整册加入。</p>

            <div v-if="notice" class="lib-notice">{{ notice }}</div>

            <div v-if="groups.length === 0" class="empty" style="padding: 10px 0 14px;">
              还没有名册
            </div>

            <div v-for="g in groups" :key="g.id" class="lib-group">
              <div class="lib-group__head">
                <span class="lib-group__dot" :style="{ background: g.color }"></span>
                <span class="lib-group__name">{{ g.name }}</span>
                <span class="lib-group__count">{{ g.members.length }}</span>
                <span class="flex-1"></span>
                <button class="btn btn--sm" @click="startEdit(g)">编辑</button>
                <button class="btn btn--sm btn--danger" @click="onDeleteGroup(g)">删除</button>
              </div>

              <div class="chip-list">
                <span
                  v-for="m in g.members"
                  :key="m.uid"
                  class="chip chip--lib"
                  :title="m.name"
                >
                  <span class="chip__name">{{ m.name }}</span>
                  <button class="chip__close" @click="onRemoveMember(g, m)" title="从名册移除" aria-label="从名册移除">×</button>
                </span>
                <span v-if="g.members.length === 0" class="text-subtle" style="font-size: 12px;">空名册 · 点「编辑」选人</span>
              </div>
            </div>

            <div style="margin-top: 14px;">
              <button class="btn btn--primary" @click="startNew">＋ 新建名册</button>
            </div>
          </template>

          <!-- 编辑视图：整块切换，不在列表下面展开 -->
          <template v-else>
            <p class="modal-lead">勾选要长期保存的人，之后可整册或按人加入当前名单。</p>

            <div class="field">
              <label class="field__label">名册名</label>
              <input
                id="lib-group-name"
                v-model="name"
                class="input"
                placeholder="例如：三班、值班名单"
                style="max-width: 300px;"
              />
            </div>

            <div class="field">
              <label class="field__label">
                成员
                <span class="text-subtle" style="font-weight: 400;">已选 {{ picked.size }} / 可选 {{ totalAvailable }}</span>
              </label>

              <div class="member-pick">
                <div class="member-pick__bar">
                  <input v-model="keyword" class="input" placeholder="搜索名字（拼音/首字母）…" />
                  <button class="btn btn--sm" @click="clearAll" :disabled="picked.size === 0">清空已选</button>
                </div>

                <div v-if="filteredSources.length === 0" class="empty" style="padding: 14px 0;">
                  {{ totalAvailable === 0 ? '没有可选的成员，先往当前名单里加人' : '没有匹配的名字' }}
                </div>

                <div v-else class="member-pick__body">
                  <div v-for="s in filteredSources" :key="s.label" class="member-pick__group">
                    <div class="member-pick__group-head">
                      <span>{{ s.label }}（{{ s.items.length }}）</span>
                      <button class="btn btn--ghost btn--xs" @click="toggleSource(s.items)">全选</button>
                    </div>
                    <div class="chip-list">
                      <label
                        v-for="n in s.items"
                        :key="s.label + n"
                        class="pick-chip"
                        :class="{ 'pick-chip--on': picked.has(n) }"
                      >
                        <input type="checkbox" :checked="picked.has(n)" @change="toggle(n)" />
                        <span class="ellipsis">{{ n }}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="modal__footer">
          <template v-if="editorOpen">
            <button class="btn" @click="onCancel">取消</button>
            <button class="btn btn--primary" :disabled="!canSave" @click="save">
              {{ editingId ? '保存名册' : '创建名册' }}
            </button>
          </template>
          <button v-else class="btn btn--primary" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.lib-group__dot {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.lib-notice {
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: var(--r-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 11px;
}
</style>
