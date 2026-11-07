<script setup lang="ts">
import { computed, inject } from 'vue'
import { useSession } from '@/composables/useSession'
import { usePicker } from '@/composables/usePicker'
import { useBundles } from '@/composables/useBundles'
import { useSettings } from '@/composables/useSettings'
import { useUi } from '@/composables/useUi'

const emit = defineEmits<{
  (e: 'pick', payload: { mode: 'single' | 'multi'; count: number }): void
}>()

const { current } = useSession()
const picker = usePicker()
const bundles = useBundles()
const { prefs } = useSettings()
const ui = useUi()
const startNewRound = inject<() => void>('startNewRound')!

const picks = computed(() => current.value?.picks ?? [])
const totalPicked = computed(() => current.value?.totalPicked ?? 0)
const poolSize = computed(() => picker.poolSize.value)
const isPlaying = computed(() => picker.isPicking.value)
const exhausted = computed(() => poolSize.value === 0 && picks.value.length > 0)
const overPool = computed(() => poolSize.value > 0 && picker.count.value > poolSize.value)

const mainLabel = computed(() => {
  if (prefs.value.pickStyle === 'animate') {
    return isPlaying.value ? prefs.value.pauseButtonText : prefs.value.startButtonText
  }
  const n = picker.effectiveCount.value
  return n > 1 ? `抽取 ${n} 人` : prefs.value.startButtonText
})

function setMode(mode: 'person' | 'group') {
  if (prefs.value.drawMode === mode) return
  prefs.value.drawMode = mode
}

function onStart() {
  if (prefs.value.pickStyle === 'animate') {
    if (isPlaying.value) {
      picker.isPicking.value = false
    } else {
      picker.startAnimate()
    }
    return
  }
  const n = picker.effectiveCount.value
  emit('pick', { mode: n === 1 ? 'single' : 'multi', count: n })
}

function onNewRound() {
  const run = () => {
    startNewRound()
    picker.clearDisplay()
    picker.lastError.value = null
  }
  if (picks.value.length === 0) { run(); return }
  void ui.askConfirm({
    title: '开始新一轮？',
    message: `本轮已抽 ${totalPicked.value} 人，记录会清空，所有人重新可被抽。`,
    confirmText: '开始新一轮',
  }).then(ok => { if (ok) run() })
}

function onUndoLast() {
  if (picks.value.length === 0) return
  picker.undoTo(picks.value.length - 1)
}
</script>

<template>
  <section class="main-section picker-bar">
    <div class="picker-bar__group">
      <span class="picker-bar__label">抽取人数</span>
      <div class="stepper">
        <button class="stepper__btn" @click="picker.dec" :disabled="picker.count.value <= 1" aria-label="减少人数">−</button>
        <span class="stepper__value">{{ picker.count.value }}</span>
        <button class="stepper__btn" @click="picker.inc" :disabled="picker.count.value >= 99" aria-label="增加人数">+</button>
      </div>

      <div class="draw-mode" role="group" aria-label="抽取口径">
        <span class="tip">
          <button
            class="draw-mode__item"
            :class="{ 'draw-mode__item--active': prefs.drawMode === 'person' }"
            @click="setMode('person')"
          >按人</button>
          <span class="tip__bubble">每个人独立参与，抽中谁就是谁</span>
        </span>
        <span class="tip">
          <button
            class="draw-mode__item"
            :class="{ 'draw-mode__item--active': prefs.drawMode === 'group' }"
            @click="setMode('group')"
          >按小组</button>
          <span class="tip__bubble">抽到小组成员时，整个小组一起出（共 {{ bundles.all.value.length }} 组）</span>
        </span>
      </div>

      <span v-if="exhausted" class="picker-bar__hint picker-bar__hint--warn">本轮已抽完，撤销或开始新一轮</span>
      <span v-else-if="overPool" class="picker-bar__hint">当前只剩 {{ poolSize }} 人可抽</span>
    </div>

    <div class="picker-bar__actions">
      <button
        class="btn btn--undo"
        @click="onNewRound"
        title="清空本轮记录，所有人重新可被抽"
      >新一轮</button>
      <button
        class="btn btn--undo"
        :class="{ 'btn--undo-glow': exhausted }"
        @click="onUndoLast"
        :disabled="picks.length === 0"
        title="撤销上一轮抽取"
      >↶ 撤销</button>
      <button
        class="btn btn--primary btn--xl"
        @click="onStart"
        :disabled="poolSize === 0 && !isPlaying"
      >{{ mainLabel }}</button>
    </div>
  </section>
</template>
