<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'

const ui = useUi()
const roster = useRoster()
const permanent = usePermanentRoster()

const newName = ref('')
const error = ref<string | null>(null)

const currentName = computed(() => {
  const uid = ui.state.renameTargetUid
  if (!uid) return ''
  if (ui.state.renameTargetFrom === 'roster') {
    return roster.entries.value.find(e => e.uid === uid)?.name ?? ''
  }
  if (ui.state.renameTargetFrom === 'permanent') {
    return permanent.entries.value.find(e => e.uid === uid)?.name ?? ''
  }
  return ''
})

watch(
  () => ui.state.renameTargetUid,
  () => {
    newName.value = currentName.value
    error.value = null
  }
)

function close() {
  ui.closeModal()
}

function confirm() {
  const v = newName.value.trim()
  const uid = ui.state.renameTargetUid
  if (!uid) return
  if (!v) {
    error.value = '名字不能为空'
    return
  }
  if (v === currentName.value) {
    close()
    return
  }
  if (ui.state.renameTargetFrom === 'roster') {
    roster.rename(uid, v)
  } else if (ui.state.renameTargetFrom === 'permanent') {
    permanent.rename(uid, v)
  }
  close()
}
</script>

<template>
<Transition name="modal">
    <div v-if="ui.state.modal === 'rename'" class="modal-backdrop" @click.self="close">
    <div class="modal">
      <div class="modal__header">
        <span>重命名</span>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label class="field__label">新名字</label>
          <input
            v-model="newName"
            class="input"
            autofocus
            @keyup.enter="confirm"
          />
          <div v-if="error" class="field__hint" style="color: var(--color-danger);">{{ error }}</div>
          <div class="field__hint">
            本次仅改该条目（UID 不变）。黑/白名单与历史中相关条目不会自动更新。
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn" @click="close">取消</button>
        <button class="btn btn--primary" @click="confirm">保存</button>
      </div>
    </div>
  </div>
</Transition>
</template>
