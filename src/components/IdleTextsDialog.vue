<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUi } from '@/composables/useUi'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useSettings } from '@/composables/useSettings'
import { DEFAULT_IDLE_TEXTS } from '@/types/settings'

const ui = useUi()
const modalRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => ui.state.modal === 'idleTexts')
useFocusTrap(isOpen, modalRef)
const { prefs } = useSettings()

const draft = ref('')

watch(
  () => ui.state.modal,
  (v) => {
    if (v === 'idleTexts') draft.value = prefs.value.idleTexts.join('\n')
  },
  { immediate: true }
)

function close() {
  ui.closeModal()
}

function save() {
  const lines = draft.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(lines)).slice(0, 20)
  prefs.value.idleTexts = unique.length > 0 ? unique : [...DEFAULT_IDLE_TEXTS]
  close()
}
</script>

<template>
  <Transition name="modal">
    <div v-if="ui.state.modal === 'idleTexts'" class="modal-backdrop" @click.self="close">
      <div
        ref="modalRef"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-texts-title"
        tabindex="-1"
      >
        <div class="modal__header">
          <h2 id="idle-texts-title" class="modal__title">空结果文案</h2>
          <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
        </div>

        <div class="modal__body">
          <p class="modal-lead">
            没有可抽的人时，抽取结果区会从下面随机挑一条显示。每次启动重新随机。
          </p>

          <div class="field">
            <label for="idle-texts-input" class="field__label">文案列表（一行一条）</label>
            <textarea
              id="idle-texts-input"
              v-model="draft"
              class="textarea"
              rows="7"
              placeholder="名单还是空的"
              data-autofocus
            ></textarea>
            <p class="field__hint">
              最多 20 条，超出的会忽略。全部清空后保存，恢复成默认文案。
            </p>
          </div>
        </div>

        <div class="modal__footer">
          <button class="btn" @click="close">取消</button>
          <button class="btn btn--primary" @click="save">保存文案</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
