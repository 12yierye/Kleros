<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { usePicker } from '@/composables/usePicker'
import { useSettings } from '@/composables/useSettings'
import type { PickRecord } from '@/types/session'

const { current } = useSession()
const { entries: roster } = useRoster()
const { getByUid } = usePermanentRoster()
const picker = usePicker()
const { prefs } = useSettings()

const picks = computed<PickRecord[]>(() => current.value?.picks ?? [])
const reversed = computed(() => [...picks.value].reverse())
const sep = computed(() => prefs.value.pickSeparator || '  ')

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

function names(pick: PickRecord): string[] {
  return pick.uids.map(resolveName)
}

/** 列表倒序展示，撤销下标需换算回正序 */
function undo(reversedIndex: number) {
  picker.undoTo(picks.value.length - 1 - reversedIndex)
}

function undoLast() {
  if (picks.value.length === 0) return
  picker.undoTo(picks.value.length - 1)
}
</script>

<template>
  <section class="main-section pick-history">
    <div class="block-head">
      <div class="block-head__text">
        <h3 class="block-head__title">
          抽取记录
          <span class="block-head__count">{{ picks.length }}</span>
        </h3>
        <p class="block-head__sub">最新在上 · 悬停某条可撤销到它之前</p>
      </div>
      <div class="block-head__actions">
        <button class="btn btn--sm" :disabled="picks.length === 0" @click="undoLast">撤销上一次</button>
      </div>
    </div>

    <div v-if="picks.length === 0" class="empty">本轮还没有抽取记录</div>

    <div v-else class="pick-log">
      <div v-for="(pick, i) in reversed" :key="`${pick.time}-${i}`" class="pick-log__row">
        <span class="pick-log__time">{{ fmtShort(pick.time) }}</span>
        <span class="pick-log__count">{{ pick.uids.length }} 人</span>
        <span class="pick-log__names">{{ names(pick).join(sep) }}</span>
        <button class="pick-log__undo" @click="undo(i)" title="撤销这次及之后的所有抽取">↶ 撤销</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pick-log {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 240px;
  overflow-y: auto;
}

.pick-log__row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 6px;
  border-radius: var(--r-sm);
  font-size: var(--fs-xs);
  transition: background 0.12s;
}

.pick-log__row:hover {
  background: var(--color-chip-bg-hover);
}

.pick-log__time {
  flex-shrink: 0;
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
}

.pick-log__count {
  flex-shrink: 0;
  color: var(--color-text-subtle);
}

.pick-log__names {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.pick-log__undo {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--r-sm);
  font-size: 11px;
  color: var(--color-text-subtle);
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, color 0.12s;
}

.pick-log__row:hover .pick-log__undo {
  opacity: 1;
}

.pick-log__undo:hover {
  background: var(--color-bg-elev);
  color: var(--color-text);
}
</style>
