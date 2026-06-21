<script setup lang="ts">
import { useUi } from '@/composables/useUi'

const ui = useUi()

function close(ok: boolean) {
  if (!ui.state.confirm) return
  ui.state.confirm.resolve(ok)
  ui.state.confirm = null
}
</script>

<template>
<Transition name="modal">
  <div v-if="ui.state.confirm" class="modal-backdrop" @click.self="close(false)">
    <div class="modal" style="max-width: 380px;">
      <div class="modal__header">
        <span>{{ ui.state.confirm.title }}</span>
      </div>
      <div class="modal__body">
        <p style="white-space: pre-wrap;">{{ ui.state.confirm.message }}</p>
      </div>
      <div class="modal__footer">
        <button class="btn" @click="close(false)">
          {{ ui.state.confirm.cancelText ?? '取消' }}
        </button>
        <button
          class="btn"
          :class="ui.state.confirm.danger ? 'btn--danger' : 'btn--primary'"
          @click="close(true)"
        >
          {{ ui.state.confirm.confirmText ?? '确定' }}
        </button>
      </div>
    </div>
  </div>
</Transition>
</template>
