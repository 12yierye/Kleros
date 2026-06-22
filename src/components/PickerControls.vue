<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { usePicker } from '@/composables/usePicker'
import { useSettings } from '@/composables/useSettings'

const mode = ref<'single' | 'multi'>('single')
const count = ref(3)
const showUndo = ref(false)

const { current, undoToPick } = useSession()
const { entries: roster } = useRoster()
const { entries: permanent } = usePermanentRoster()
const picker = usePicker()
const { prefs, update } = useSettings()

const emit = defineEmits<{
  (e: 'pick', payload: { mode: 'single' | 'multi'; count: number }): void
}>()

const canMulti = computed(() => mode.value === 'multi')
const picks = computed(() => current.value?.picks ?? [])
const poolEmpty = computed(() => picker.poolSize.value === 0 && picks.value.length > 0)
const isPlaying = computed(() => picker.isPicking.value)

function pickDisplay(pickIndex: number): string {
  const pick = picks.value[pickIndex]
  if (!pick) return ''
  return pick.uids.map(uid => {
    const r = roster.value.find(e => e.uid === uid)
    if (r) return r.name
    const p = permanent.value.find(e => e.uid === uid)
    if (p) return p.name
    return uid.slice(-6)
  }).join('、')
}

function dec() { count.value = Math.max(1, count.value - 1) }
function inc() { count.value = Math.min(99, count.value + 1) }

function onStart() {
  showUndo.value = false
  if (prefs.value.pickStyle === 'animate') {
    if (picker.isPicking.value) {
      picker.isPicking.value = false
    } else {
      picker.startAnimate()
    }
  } else {
    emit('pick', { mode: mode.value, count: count.value })
  }
}

function onUndo(pickIndex: number) {
  showUndo.value = false
  const undone = undoToPick(pickIndex)
  if (undone) {
    picker.lastResults.value = []
    picker.lastError.value = null
    const set = new Set(undone)
    for (const e of roster.value) {
      if (set.has(e.uid)) e.pickedThisSession = false
    }
  }
}

function toggleUndo() { showUndo.value = !showUndo.value }
function closeUndo() { showUndo.value = false }

function onQuickUndo() {
  showUndo.value = false
  if (picks.value.length === 0) return
  onUndo(picks.value.length - 1)
}
</script>

<template>
  <section class="main-section">
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="radio-group" role="tablist" aria-label="抽取风格">
          <button
            class="radio-group__item"
            :class="{ 'radio-group__item--active': prefs.pickStyle === 'animate' }"
            @click="update('pickStyle', 'animate')"
            role="tab"
            :aria-selected="prefs.pickStyle === 'animate'"
          >开始/暂停</button>
          <button
            class="radio-group__item"
            :class="{ 'radio-group__item--active': prefs.pickStyle === 'direct' }"
            @click="update('pickStyle', 'direct')"
            role="tab"
            :aria-selected="prefs.pickStyle === 'direct'"
          >直接抽取</button>
        </div>

        <template v-if="prefs.pickStyle === 'direct'">
          <div class="radio-group" role="tablist" aria-label="抽取模式">
            <button
              class="radio-group__item"
              :class="{ 'radio-group__item--active': mode === 'single' }"
              @click="mode = 'single'"
              role="tab"
              :aria-selected="mode === 'single'"
            >单抽</button>
            <button
              class="radio-group__item"
              :class="{ 'radio-group__item--active': mode === 'multi' }"
              @click="mode = 'multi'"
              role="tab"
              :aria-selected="mode === 'multi'"
            >多抽</button>
          </div>

          <div v-if="canMulti" style="display: flex; align-items: center; gap: 6px;">
            <span class="text-muted" style="font-size: 13px;">人数</span>
            <div class="stepper">
              <button class="stepper__btn" @click="dec" :disabled="count <= 1">−</button>
              <span class="stepper__value">{{ count }}</span>
              <button class="stepper__btn" @click="inc" :disabled="count >= 99">+</button>
            </div>
          </div>
        </template>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="position: relative;">
          <div class="btn-group">
            <button class="btn btn--undo-quick" @click="onQuickUndo" :disabled="picks.length === 0" title="撤回上轮">↶</button>
            <button class="btn btn--undo-dropdown" :class="{ 'btn--undo-glow': poolEmpty }" @click="toggleUndo" :disabled="picks.length === 0" title="撤销到…">↩</button>
          </div>
          <div
            v-if="showUndo && picks.length > 0"
            style="position: absolute; top: 100%; right: 0; margin-top: 4px; background: var(--color-bg); border: 1px solid var(--color-border-strong); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 50; min-width: 200px; max-height: 360px; overflow-y: auto;"
          >
            <div style="padding: 6px 10px; font-size: 12px; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border);">撤销到...</div>
            <button v-for="(_, i) in picks" :key="i" class="btn btn--ghost" style="display: block; width: 100%; text-align: left; padding: 6px 10px; font-size: 13px; border-radius: 0;" @click="onUndo(i)">第{{ i + 1 }}轮 · {{ pickDisplay(i) }}</button>
          </div>
          <div v-if="showUndo" style="position: fixed; inset: 0; z-index: 40;" @click="closeUndo" />
        </div>

        <button class="btn btn--primary btn--xl" @click="onStart">
          <template v-if="prefs.pickStyle === 'animate' && isPlaying">{{ prefs.pauseButtonText }}</template>
          <template v-else>{{ prefs.startButtonText }}</template>
        </button>
      </div>
    </div>
  </section>
</template>
