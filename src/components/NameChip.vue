<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const markLabel = computed(() => props.marks.length
  ? `${props.name}，${props.marks.map(m => `${m.kind === 'bundle' ? '小组' : '名册'} ${m.name}`).join('；')}`
  : undefined
)

/** 只有小组有颜色；名册保留同宽的空位，保证两行文字对齐 */
function tipDotColor(m: RosterMark): string | undefined {
  return m.kind === 'bundle' ? m.color : undefined
}

function onChipClick() {
  if (props.selectable) emit('check')
}

/* 名单栏和 chip 列表都有滚动/裁切，归属提示必须 Teleport 到 body 才不会被吞 */
const chipRef = ref<HTMLElement | null>(null)
const tipRef = ref<HTMLElement | null>(null)
const tipVisible = ref(false)
const tipPos = ref({ left: 0, top: 0 })

function positionTip() {
  const chip = chipRef.value
  const tip = tipRef.value
  if (!chip || !tip) return
  const rect = chip.getBoundingClientRect()
  const w = tip.offsetWidth
  const h = tip.offsetHeight
  let left = rect.left + rect.width / 2 - w / 2
  left = Math.max(8, Math.min(window.innerWidth - w - 8, left))
  let top = rect.top - h - 8
  if (top < 8) top = rect.bottom + 8
  tipPos.value = { left, top }
}

function showTip() {
  if (!props.marks.length) return
  positionTip()
  tipVisible.value = true
}

function hideTip() {
  tipVisible.value = false
}

function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && chipRef.value?.contains(next)) return
  hideTip()
}

function onViewportChange() {
  hideTip()
}

onMounted(() => {
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <span
    ref="chipRef"
    class="chip"
    :class="{
      'chip--picked': props.picked,
      'chip--blocked': props.blocked,
      'chip--marked': !!props.accent,
      'chip--selectable': props.selectable,
    }"
    :style="props.accent ? { '--chip-accent': props.accent } : undefined"
    :title="props.marks.length ? '' : props.name"
    :tabindex="props.marks.length ? 0 : undefined"
    :role="props.marks.length ? 'group' : undefined"
    :aria-label="markLabel"
    @click="onChipClick"
    @mouseenter="showTip"
    @mouseleave="hideTip"
    @focusin="showTip"
    @focusout="onFocusOut"
  >
    <span class="chip__name">{{ props.name }}</span>
    <span class="chip__trail">
      <label v-if="props.selectable" class="chip__check" @click.stop>
        <input type="checkbox" :checked="props.checked" @change="emit('check')" />
      </label>
      <button
        v-else
        class="chip__edit"
        @click="emit('rename')"
        title="重命名"
        aria-label="重命名"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
    </span>
    <button
      v-if="props.closable"
      class="chip__close"
      @click="emit('close')"
      title="移除"
      aria-label="移除"
    >×</button>

    <Teleport to="body">
      <span
        v-if="props.marks.length"
        ref="tipRef"
        class="chip__tip"
        :class="{ 'chip__tip--visible': tipVisible }"
        :style="{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }"
        role="tooltip"
      >
        <span v-for="m in props.marks" :key="`${m.kind}-${m.name}`" class="chip__tip-row">
          <span class="chip__tip-glyph" aria-hidden="true">
            <span
              v-if="m.kind === 'bundle'"
              class="chip__tip-dot"
              :style="{ background: tipDotColor(m) }"
            ></span>
            <svg
              v-else
              class="chip__tip-bookmark"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span>{{ m.name }}</span>
        </span>
      </span>
    </Teleport>
  </span>
</template>
