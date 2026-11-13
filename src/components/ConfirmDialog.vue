<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUi } from '@/composables/useUi'
import { useFocusTrap } from '@/composables/useFocusTrap'

const ui = useUi()
const modalRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => !!ui.state.confirm)
useFocusTrap(isOpen, modalRef)

function close(ok: boolean) {
  if (!ui.state.confirm) return
  ui.state.confirm.resolve(ok)
  ui.state.confirm = null
}
</script>

<template>
<Transition name="modal">
  <div v-if="ui.state.confirm" class="modal-backdrop modal-backdrop--confirm" @click.self="close(false)">
    <div
      ref="modalRef"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      tabindex="-1"
      style="max-width: 380px;"
    >
      <div class="modal__header">
        <h2 id="confirm-dialog-title" class="modal__title">{{ ui.state.confirm.title }}</h2>
      </div>
      <div class="modal__body">
        <p style="white-space: pre-wrap;">{{ ui.state.confirm.message }}</p>
      </div>
      <div class="modal__footer">
        <button class="btn" data-autofocus @click="close(false)">
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
