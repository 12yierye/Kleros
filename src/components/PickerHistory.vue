<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { usePicker } from '@/composables/usePicker'
import { useSettings } from '@/composables/useSettings'
import type { PickRecord, PickUnitRecord } from '@/types/session'

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

/** 旧记录没有 units 字段：回退成「每人一个签」 */
function unitsOf(pick: PickRecord): PickUnitRecord[] {
  if (pick.units && pick.units.length > 0) return pick.units
  return pick.uids.map(uid => ({ label: resolveName(uid), uids: [uid] }))
}

function fmtShort(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
        <p class="block-head__sub">最新在上 · 悬停某条可撤销到它之前 · 固定 6 条高度</p>
      </div>
      <div class="block-head__actions">
        <button class="btn btn--sm" :disabled="picks.length === 0" @click="undoLast">撤销上一次</button>
      </div>
    </div>

    <div class="pick-log">
      <div v-if="picks.length === 0" class="pick-log__empty">本轮还没有抽取记录</div>

      <template v-else>
        <div v-for="(pick, i) in reversed" :key="`${pick.time}-${i}`" class="pick-log__row">
          <span class="pick-log__time">{{ fmtShort(pick.time) }}</span>
          <span class="pick-log__count">{{ pick.uids.length }} 人</span>
          <span class="pick-log__names">
            <template v-for="(u, ui) in unitsOf(pick)" :key="ui">
              <span v-if="ui > 0" class="pick-log__sep">{{ sep }}</span>
              <template v-if="u.uids.length > 1">
                <b class="pick-log__group">{{ u.label }}</b>
                <span class="pick-log__members">（{{ u.uids.map(resolveName).join(sep) }}）</span>
              </template>
              <template v-else>{{ resolveName(u.uids[0]) }}</template>
            </template>
          </span>
          <button class="pick-log__undo" @click="undo(i)" title="撤销这次及之后的所有抽取">↶ 撤销</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.pick-log {
  /* 固定 6 条高度，内部滚动：条数变化不再挤压抽取结果区 */
  --pick-row-h: 30px;
  height: calc(var(--pick-row-h) * 6 + 5px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-radius: var(--r-sm);
}

.pick-log__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-subtle);
  font-size: var(--fs-xs);
}

.pick-log__row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-height: var(--pick-row-h);
  padding: 5px 6px;
  border-radius: var(--r-sm);
  font-size: var(--fs-xs);
  transition: background 0.12s;
  flex-shrink: 0;
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

.pick-log__group {
  color: var(--color-primary);
  font-weight: 700;
}

.pick-log__members {
  color: var(--color-text-muted);
}

.pick-log__sep {
  white-space: pre;
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
