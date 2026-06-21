<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useSession } from '@/composables/useSession'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'

const ui = useUi()
const roster = useRoster()
const permanent = usePermanentRoster()
const session = useSession()
const bw = useBlackWhiteList()

const oldName = ref('')
const newName = ref('')
const error = ref<string | null>(null)
const updateHistory = ref(true)
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
  updateHistory.value = true
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

  const selectedUids = new Set(selected.map(m => m.uid))

  // 1. 改名字（按 UID）
  for (const m of selected) {
    if (m.from === 'roster') roster.rename(m.uid, newN)
    else permanent.rename(m.uid, newN)
  }

  // 2. 历史会话（按 UID；UID 不变所以实际上不需要改 picks.uids，但需要更新匹配项的展示名）
  // 由于历史中只存了 UID，显示时再查表，因此这里无需改 picks 内容。
  // 但若开启了"修改历史中此人记录"，语义上指历史展示也跟着新名。
  // 实现上：保持 UID 稳定即可，显示层会自动用新名。这里仅做提示用。
  if (updateHistory.value) {
    // 当前会话的 picks 数组只需保留 UID，渲染时按当前 name 解析
    // 历史压缩条目已不再有 picks 详情，无需改
    // 因此本块仅作为用户意图记录
  }

  // 3. 黑/白名单（按 name 字符串）
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
    <div class="modal modal--wide">
      <div class="modal__header">
        <span>全局重命名</span>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label class="field__label">原名字</label>
          <input v-model="oldName" class="input" placeholder="输入要改的原名" />
        </div>
        <div class="field">
          <label class="field__label">新名字</label>
          <input v-model="newName" class="input" placeholder="新名字" />
        </div>

        <div v-if="matches.length > 0" class="field">
          <label class="field__label">匹配到 {{ matches.length }} 条</label>
          <ul>
            <li v-for="m in matches" :key="m.from + m.uid" class="checkbox">
              <input type="checkbox" v-model="m.selected" />
              <span>
                {{ m.currentName }}
                <span class="text-subtle">({{ m.from === 'roster' ? '临时' : '常驻' }})</span>
              </span>
            </li>
          </ul>
        </div>

        <div v-else-if="oldName.trim()" class="text-subtle">没有匹配的条目</div>

        <div class="field">
          <label class="checkbox">
            <input type="checkbox" v-model="updateHistory" />
            同时修改历史会话中抽中此人的记录（按 UID 匹配；UID 不变，记录继续有效）
          </label>
          <label class="checkbox">
            <input type="checkbox" v-model="updateBlackWhite" />
            同时替换黑/白名单中的原名为新名
          </label>
        </div>

        <div v-if="error" class="field__hint" style="color: var(--color-danger);">{{ error }}</div>
      </div>
      <div class="modal__footer">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn--primary" @click="confirm">应用</button>
      </div>
    </div>
  </div>
</Transition>
</template>
