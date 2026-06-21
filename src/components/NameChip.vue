<script setup lang="ts">
interface Props {
  name: string
  picked?: boolean
  blocked?: boolean
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  picked: false,
  blocked: false,
  closable: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'promote'): void
  (e: 'rename'): void
}>()
</script>

<template>
  <span
    class="chip"
    :class="{ 'chip--picked': props.picked, 'chip--blocked': props.blocked }"
    :title="props.name"
  >
    <span class="chip__name">{{ props.name }}</span>
    <button
      class="chip__edit"
      @click="emit('rename')"
      title="重命名"
      aria-label="重命名"
    >✏</button>
    <button
      v-if="props.closable"
      class="chip__close"
      @click="emit('close')"
      title="移除"
      aria-label="移除"
    >×</button>
  </span>
</template>
