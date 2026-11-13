<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useBundles } from '@/composables/useBundles'

const ui = useUi()
const modalRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => ui.state.modal === 'globalRename')
useFocusTrap(isOpen, modalRef)
const roster = useRoster()
const permanent = usePermanentRoster()
const bw = useBlackWhiteList()
const bundles = useBundles()

const oldName = ref('')
const newName = ref('')
const error = ref<string | null>(null)
const updateBlackWhite = ref(true)

interface MatchedItem {
  uid: string
  from: 'roster' | 'permanent'
  currentName: string
  selected: boolean
}

const matches = ref<MatchedItem[]>([])

watch(oldName, (v) => {
  const name = v.trim()
  matches.value = []
  if (!name) return
  for (const e of roster.entries.value) {
    if (e.name === name) {
      matches.value.push({ uid: e.uid, from: 'roster', currentName: e.name, selected: true })
    }
  }
  for (const e of permanent.entries.value) {
    if (e.name === name) {
      matches.value.push({ uid: e.uid, from: 'permanent', currentName: e.name, selected: true })
    }
  }
})

function close() {
  ui.closeModal()
  reset()
}

function reset() {
  oldName.value = ''
  newName.value = ''
  matches.value = []
  updateBlackWhite.value = true
  error.value = null
}

function confirm() {
  const oldN = oldName.value.trim()
  const newN = newName.value.trim()
  if (!oldN) { error.value = '请输入原名'; return }
  if (!newN) { error.value = '请输入新名'; return }
  if (oldN === newN) { error.value = '新旧名字相同'; return }
  if (matches.value.length === 0) { error.value = '未找到匹配条目'; return }
  const selected = matches.value.filter(m => m.selected)
  if (selected.length === 0) { error.value = '请至少勾选一个条目'; return }

  // 1. 改名字（按 UID）
  for (const m of selected) {
    if (m.from === 'roster') roster.rename(m.uid, newN)
    else permanent.rename(m.uid, newN)
  }

  // 1.5 小组按名字引用成员，同步改名，避免成员从小群里掉出去
  bundles.renameMember(oldN, newN)

  // 2. 黑/白名单（按 name 字符串）
  if (updateBlackWhite.value) {
    bw.list.value.black = bw.list.value.black.map(n => n === oldN ? newN : n)
    bw.list.value.white = bw.list.value.white.map(n => n === oldN ? newN : n)
  }

  close()
}
</script>

<template>
<Transition name="modal">
    <div v-if="ui.state.modal === 'globalRename'" class="modal-backdrop" @click.self="close">
    <div
      ref="modalRef"
      class="modal modal--wide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-rename-title"
      tabindex="-1"
    >
      <div class="modal__header">
        <h2 id="global-rename-title" class="modal__title">全局重命名</h2>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label for="global-rename-old" class="field__label">原名字</label>
          <input id="global-rename-old" v-model="oldName" class="input" placeholder="输入要改的原名" data-autofocus />
        </div>
        <div class="field">
          <label for="global-rename-new" class="field__label">新名字</label>
          <input id="global-rename-new" v-model="newName" class="input" placeholder="新名字" />
        </div>

        <div v-if="matches.length > 0" class="field">
          <label class="field__label">匹配到 {{ matches.length }} 条</label>
          <ul>
            <li v-for="m in matches" :key="m.from + m.uid" class="checkbox">
              <input type="checkbox" v-model="m.selected" />
              <span>
                {{ m.currentName }}
                <span class="text-subtle">({{ m.from === 'roster' ? '当前名单' : '名册' }})</span>
              </span>
            </li>
          </ul>
        </div>

        <div v-else-if="oldName.trim()" class="text-subtle">没有匹配的条目</div>

        <div class="field">
          <label class="checkbox">
            <input type="checkbox" v-model="updateBlackWhite" />
            同时替换黑/白名单中的原名为新名
          </label>
          <p class="field__hint">历史记录按 UID 展示，改名后会自动显示新名字。</p>
        </div>

        <div v-if="error" class="field__hint" role="alert" style="color: var(--color-danger);">{{ error }}</div>
      </div>
      <div class="modal__footer">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn--primary" @click="confirm">应用</button>
      </div>
    </div>
  </div>
</Transition>
</template>
