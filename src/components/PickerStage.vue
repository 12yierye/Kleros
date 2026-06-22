<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { usePicker } from '@/composables/usePicker'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useSettings } from '@/composables/useSettings'
import type { PickRecord } from '@/types/session'
import type { CandidateItem } from '@/utils/pick'

const { isPicking, isAnimating: pickerAnim, blockAttempt, lastResults, lastError, pool, poolSize, commitAnimatePick } = usePicker()
const { current } = useSession()
const { entries: roster } = useRoster()
const { getByUid } = usePermanentRoster()
const { prefs } = useSettings()

const pulseName = ref<string | null>(null)
const scrollingName = ref('')
const scrollingItem = ref<CandidateItem | null>(null)
let scrollTimer: ReturnType<typeof setInterval> | null = null

const picks = computed<PickRecord[]>(() => current.value?.picks ?? [])
const reversedPicks = computed(() => [...picks.value].reverse())

watch(isPicking, (val) => {
  if (val && prefs.value.pickStyle === 'animate') {
    const names = pool.value
    if (names.length === 0) return
    const first = names[Math.floor(Math.random() * names.length)]
    scrollingName.value = first.name
    scrollingItem.value = first
    scrollTimer = setInterval(() => {
      const idx = Math.floor(Math.random() * names.length)
      scrollingName.value = names[idx].name
      scrollingItem.value = names[idx]
    }, 50)
  } else {
    if (scrollTimer) {
      clearInterval(scrollTimer)
      scrollTimer = null
    }
    if (!val) {
      if (pickerAnim.value && scrollingItem.value) {
        commitAnimatePick(scrollingItem.value)
        pulseName.value = scrollingItem.value.name
        scrollingItem.value = null
      } else if (lastResults.value.length > 0) {
        pulseName.value = lastResults.value[lastResults.value.length - 1].name
      }
    }
  }
})

watch(() => picks.value.length, (len, oldLen) => {
  if (len < oldLen) {
    if (len === 0) {
      pulseName.value = null
    } else {
      const lastPick = picks.value[picks.value.length - 1]
      if (lastPick && lastPick.uids.length > 0) {
        pulseName.value = resolveName(lastPick.uids[lastPick.uids.length - 1])
      }
    }
  }
})

onBeforeUnmount(() => {
  if (scrollTimer) clearInterval(scrollTimer)
})

const isEmpty = computed(() => !isPicking.value && !lastError.value && poolSize.value === 0)
const isExhausted = computed(() => isEmpty.value && picks.value.length > 0)

const display = computed(() => {
  if (lastError.value) return lastError.value
  if (isPicking.value && prefs.value.pickStyle === 'animate') return scrollingName.value || '…'
  if (isPicking.value) return '…'
  if (isExhausted.value) return '抽完了，请回溯'
  if (pulseName.value) return pulseName.value
  return '准备就绪'
})

const isPlaceholder = computed(() =>
  !isPicking.value && !pulseName.value && !lastError.value && !isExhausted.value
)

const isError = computed(() => !!lastError.value)
const isPulsing = computed(() => !!pulseName.value && !isPicking.value && !lastError.value)

function resolveName(uid: string): string {
  const r = roster.value.find(e => e.uid === uid)
  if (r) return r.name
  const p = getByUid(uid)
  if (p) return p.name
  return uid.slice(-6)
}

function fmtShort(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <section class="picker-stage" :class="{ 'picker-stage--blocked': blockAttempt }">
    <div
      class="picker-stage__display"
      :class="{
        'picker-stage__display--placeholder': isPlaceholder,
        'picker-stage__display--scrolling': isPicking && prefs.pickStyle === 'animate',
        'picker-stage__display--pulsing': isPulsing,
        'picker-stage__display--exhausted': isExhausted,
      }"
      :style="isError ? { color: 'var(--color-danger)' } : (isExhausted ? { color: 'var(--color-warning)' } : {})"
    >
      <Transition name="scroll-name" mode="out-in">
        <span :key="display">{{ display }}</span>
      </Transition>
    </div>
    <div v-if="lastResults.length > 1 && !isPicking && !lastError" class="picker-stage__sub">
      本轮 {{ lastResults.length }} 人
    </div>

    <div v-if="reversedPicks.length > 0" class="picker-stage__history">
      <div class="picker-stage__history-title">抽取记录</div>
      <div
        v-for="(pick, i) in reversedPicks"
        :key="i"
        class="picker-stage__history-item"
      >
        <span class="picker-stage__history-time">{{ fmtShort(pick.time) }}</span>
        <span class="picker-stage__history-mode">{{ pick.mode === 'single' ? '单抽' : '多抽' }}</span>
        <span class="picker-stage__history-names">
          {{ pick.uids.map(resolveName).join(' · ') }}
        </span>
      </div>
    </div>
  </section>
</template>
