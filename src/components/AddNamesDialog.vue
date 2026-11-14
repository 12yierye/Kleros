<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUi } from '@/composables/useUi'
import { useFocusTrap } from '@/composables/useFocusTrap'
import InputPanel from './InputPanel.vue'

const ui = useUi()
const modalRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => ui.state.modal === 'addNames')
useFocusTrap(isOpen, modalRef)

function close() {
  ui.closeModal()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="ui.state.modal === 'addNames'" class="modal-backdrop" @click.self="close">
      <div
        ref="modalRef"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-names-title"
        tabindex="-1"
      >
        <div class="modal__header">
          <h2 id="add-names-title" class="modal__title">添加到当前名单</h2>
          <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal__body">
          <InputPanel />
        </div>

        <div class="modal__footer">
          <button class="btn" @click="close">完成</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
