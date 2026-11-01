<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  label: '开关',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <button
    type="button"
    class="switch"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="switch__knob"></span>
  </button>
</template>

<style scoped>
.switch {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 22px;
  padding: 0;
  border-radius: var(--r-full);
  background: var(--color-border-strong);
  transition: background 0.16s ease;
}

.switch[aria-checked='true'] {
  background: var(--color-primary);
}

.switch__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.16s ease;
}

.switch[aria-checked='true'] .switch__knob {
  transform: translateX(16px);
}

.switch:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
