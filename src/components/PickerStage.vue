<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { usePicker } from '@/composables/usePicker'
import { useSession } from '@/composables/useSession'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useSettings } from '@/composables/useSettings'
import { shuffle } from '@/utils/pick'
import type { PickUnitRecord } from '@/types/session'

const picker = usePicker()
const { current } = useSession()
const { entries: rosterEntries } = useRoster()
const { entries: permEntries } = usePermanentRoster()
const { prefs } = useSettings()

const {
  isPicking, isAnimating, blockAttempt, displayUnits, displayUids,
  lastError, poolSize, effectiveCount, units, stopAnimate,
} = picker

/** 与 CSS 里的 .reel__item 高度保持一致 */
const ITEM_H = 60
const MAX_LANES = 6
/** 速度 1.0 时每秒滚过的像素 */
const BASE_PX_PER_SEC = 620

interface Lane {
  /** 渲染用：名单重复两遍，保证循环接缝不可见 */
  items: string[]
  /** 循环长度（单份名单的项数） */
  loop: number
}

const lanes = ref<Lane[]>([])

const picks = computed(() => current.value?.picks ?? [])
const sep = computed(() => prefs.value.pickSeparator || '  ')
const isRolling = computed(() => isPicking.value && prefs.value.pickStyle === 'animate' && lanes.value.length > 0)

/** 0.1 – 3，1 为基准 */
const speed = computed(() => {
  const v = Number(prefs.value.scrollSpeed)
  return Number.isFinite(v) ? Math.min(3, Math.max(0.1, v)) : 1
})

function nameOf(uid: string): string {
  const r = rosterEntries.value.find(e => e.uid === uid)
  if (r) return r.name
  const p = permEntries.value.find(e => e.uid === uid)
  if (p) return p.name
  return uid.slice(-6)
}

function unitMembers(u: PickUnitRecord): string[] {
  return u.uids.map(nameOf)
}

function buildLanes() {
  // 按小组抽时 label 是小组名，按人抽时是人名
  const labels = units.value.map(u => u.label)
  if (labels.length === 0) {
    lanes.value = []
    return
  }
  const laneCount = Math.max(1, Math.min(effectiveCount.value, labels.length, MAX_LANES))
  const out: Lane[] = []
  for (let i = 0; i < laneCount; i++) {
    const list = shuffle(labels)
    while (list.length < 4) list.push(...list.slice(0, 4 - list.length))
    out.push({ items: [...list, ...list], loop: list.length })
  }
  lanes.value = out
}

/**
 * 匀速滚动交给 CSS 动画（线性、无限循环），避免 JS 定时器造成的忽快忽慢。
 * 所有列共用同一相位，整行同步上移，速度由 duration = 循环高度 / 像素速度决定。
 */
function laneStyle(lane: Lane) {
  const cycle = lane.loop * ITEM_H
  const seconds = cycle / (BASE_PX_PER_SEC * speed.value)
  return {
    '--reel-cycle': `${cycle}px`,
    animationDuration: `${seconds.toFixed(3)}s`,
  }
}

watch(isPicking, (val) => {
  if (val && prefs.value.pickStyle === 'animate') {
    buildLanes()
    return
  }
  if (val) return

  if (isAnimating.value) {
    // 停下时按当前人数与口径正式抽取，结果即最终结果
    stopAnimate(effectiveCount.value)
    lanes.value = []
  }
})

const isExhausted = computed(() => poolSize.value === 0 && picks.value.length > 0)
const isPulse = computed(() => !isPicking.value && !lastError.value && displayUnits.value.length > 0)

/** 按小组抽但没有可用小组：名单里有人，但一个都凑不成组 */
const noGroupAvailable = computed(() =>
  prefs.value.drawMode === 'group'
  && poolSize.value === 0
  && !isExhausted.value
  && rosterEntries.value.length + permEntries.value.length > 0
)

/* ---------- 空态文案：启动随机一条，设置里可改 ---------- */
const idleText = ref('')
function rollIdleText() {
  const list = prefs.value.idleTexts?.length ? prefs.value.idleTexts : ['这里还什么都没有']
  idleText.value = list[Math.floor(Math.random() * list.length)]
}
onMounted(rollIdleText)
watch(() => prefs.value.idleTexts, rollIdleText, { deep: true })

/** 结果里是否有小组签：有就按「组名 + 成员」排版 */
const hasGroupUnit = computed(() => displayUnits.value.some(u => u.uids.length > 1))

const display = computed(() => {
  if (lastError.value) return lastError.value
  if (isPicking.value) return '…'
  // 有过抽取结果就一直显示名字，不会被新一轮 / 自动重置清掉
  if (isPulse.value) return displayUids.value.map(nameOf).join(sep.value)
  if (isExhausted.value) return '本轮已抽完'
  if (noGroupAvailable.value) return '没有可抽的小组'
  // 没抽过（或刚开新一轮）：显示一条随机空态文案
  return idleText.value
})

const isPlaceholder = computed(() =>
  !isPicking.value && !isPulse.value && !lastError.value && !isExhausted.value && !noGroupAvailable.value
)

const sub = computed(() => {
  if (lastError.value) return ''
  if (isPicking.value && poolSize.value === 1) return '候选只剩 1 人，结果已经确定'
  if (isPicking.value) return `正在抽取 ${Math.min(effectiveCount.value, poolSize.value)} 个`
  if (isPulse.value && picks.value.length === 0) return '上一轮的结果'
  if (isPulse.value && displayUids.value.length > 1) return `本次 ${displayUids.value.length} 人`
  if (isExhausted.value && isPulse.value) return '本轮已抽完，撤销或开始新一轮'
  if (noGroupAvailable.value) return '按小组抽只在小组内选人，先去「小组」建组或切回按人'
  if (isPlaceholder.value && poolSize.value > 0) return `可抽 ${poolSize.value} 人`
  return ''
})

const isMany = computed(() => displayUids.value.length >= 4)
const isMulti = computed(() => displayUids.value.length > 1)
</script>

<template>
  <section class="picker-stage" :class="{ 'picker-stage--blocked': blockAttempt }">
    <div
      class="picker-stage__display"
      :class="{
        'picker-stage__display--placeholder': isPlaceholder,
        'picker-stage__display--scrolling': isPicking,
        'picker-stage__display--pulsing': isPulse,
        'picker-stage__display--exhausted': (isExhausted || noGroupAvailable) && !isPulse,
        'picker-stage__display--many': isMany,
        'picker-stage__display--multi': isMulti,
      }"
      :style="lastError
        ? { color: 'var(--color-danger)' }
        : ((isExhausted || noGroupAvailable) && !isPulse ? { color: 'var(--color-warning)' } : {})"
    >
      <Transition name="reveal" mode="out-in">
        <div
          v-if="isRolling"
          key="reel"
          class="reel-row"
          :class="{ 'reel-row--dense': lanes.length >= 3, 'reel-row--compact': lanes.length >= 5 }"
        >
          <template v-for="(lane, i) in lanes" :key="i">
            <span v-if="i > 0" class="reel__sep">{{ sep }}</span>
            <div class="reel">
              <div class="reel__track" :style="laneStyle(lane)">
                <span v-for="(n, j) in lane.items" :key="j" class="reel__item">{{ n }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 小组签：组名在上，成员在下 -->
        <div v-else-if="isPulse && hasGroupUnit" key="units" class="picker-units">
          <div v-for="(u, i) in displayUnits" :key="`${u.label}-${i}`" class="picker-unit">
            <span class="picker-unit__label" :style="u.color ? { color: u.color } : undefined">{{ u.label }}</span>
            <span v-if="u.uids.length > 1" class="picker-unit__members">{{ unitMembers(u).join(sep) }}</span>
          </div>
        </div>

        <span v-else :key="display" class="picker-stage__text">{{ display }}</span>
      </Transition>
    </div>
    <div v-if="sub" class="picker-stage__sub">{{ sub }}</div>
  </section>
</template>

<style scoped>
.picker-units {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0;
  max-height: 320px;
  overflow-y: auto;
  width: 100%;
  padding: 4px;
}

.picker-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.picker-unit__label {
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-primary);
  word-break: break-word;
}

.picker-unit__members {
  font-size: 24px;
  color: var(--color-text);
  line-height: 1.4;
  letter-spacing: 0.03em;
  word-break: break-word;
}
</style>
