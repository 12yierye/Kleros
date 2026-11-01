<script setup lang="ts">
import type { RosterMark } from '@/types/roster'

interface Props {
  name: string
  picked?: boolean
  blocked?: boolean
  closable?: boolean
  selectable?: boolean
  checked?: boolean
  /** 归属色：用于给 chip 本身着色 */
  accent?: string
  /** 归属明细：悬停时用 tooltip 说明 */
  marks?: RosterMark[]
}

const props = withDefaults(defineProps<Props>(), {
  picked: false,
  blocked: false,
  closable: false,
  selectable: false,
  checked: false,
  accent: '',
  marks: () => [],
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'promote'): void
  (e: 'rename'): void
  (e: 'check'): void
}>()
</script>

<template>
  <span
    class="chip"
    :class="{
      'chip--picked': props.picked,
      'chip--blocked': props.blocked,
      'chip--marked': !!props.accent,
    }"
    :style="props.accent ? { '--chip-accent': props.accent } : undefined"
    :title="props.marks.length ? '' : props.name"
  >
    <label v-if="props.selectable" class="chip__check" @click.stop>
      <input type="checkbox" :checked="props.checked" @change="emit('check')" />
    </label>
    <span class="chip__name">{{ props.name }}</span>
    <button
      class="chip__edit"
      @click="emit('rename')"
      title="重命名"
      aria-label="重命名"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </button>
    <button
      v-if="props.closable"
      class="chip__close"
      @click="emit('close')"
      title="移除"
      aria-label="移除"
    >×</button>

    <span v-if="props.marks.length" class="chip__tip" role="tooltip">
      <span v-for="m in props.marks" :key="`${m.kind}-${m.name}`" class="chip__tip-row">
        <span class="chip__tip-dot" :style="{ background: m.color }"></span>
        <span>{{ m.kind === 'bundle' ? '绑定小组' : '名册' }} · {{ m.name }}</span>
      </span>
    </span>
  </span>
</template>
