<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useRoster } from '@/composables/useRoster'
import ToggleSwitch from './ToggleSwitch.vue'

const { prefs, update } = useSettings()
const { entries } = useRoster()

const rosterCount = computed(() => entries.value.length)

/** 本轮不重复：开关直接映射布尔值 */
const noRepeat = computed({
  get: () => prefs.value.noRepeatInSession,
  set: (v: boolean) => update('noRepeatInSession', v),
})

/** 自动重置：开关关闭时写 0（内部约定），打开时给一个合理默认值 */
const autoReset = computed({
  get: () => prefs.value.autoNewSessionAfter > 0,
  set: (v: boolean) => {
    update('autoNewSessionAfter', v ? Math.max(1, rosterCount.value || 10) : 0)
  },
})

const limit = computed(() => Math.max(1, prefs.value.autoNewSessionAfter))

function setLimit(v: number) {
  update('autoNewSessionAfter', Math.min(999, Math.max(1, v)))
}

function useWholeRoster() {
  if (rosterCount.value > 0) setLimit(rosterCount.value)
}
</script>

<template>
  <div class="panel-block">
    <div class="panel-block__head">
      <span class="panel-block__title">抽取参数</span>
    </div>

    <div class="opt-row">
      <div class="opt-row__text">
        <span class="opt-row__label">本轮不重复</span>
        <span class="opt-row__desc">抽过的人本轮不再出现</span>
      </div>
      <ToggleSwitch v-model="noRepeat" label="本轮不重复" />
    </div>

    <div class="opt-row">
      <div class="opt-row__text">
        <span class="opt-row__label">自动开始新一轮</span>
        <span class="opt-row__desc">
          {{ autoReset ? '抽够指定人数后自动清空本轮' : '只在你点「新一轮」时重置' }}
        </span>
      </div>
      <ToggleSwitch v-model="autoReset" label="自动开始新一轮" />
    </div>

    <div v-if="autoReset" class="opt-limit">
      <div class="opt-limit__row">
        <span class="opt-row__label">抽满</span>
        <div class="stepper stepper--sm">
          <button
            class="stepper__btn"
            :disabled="limit <= 1"
            aria-label="减少人数"
            @click="setLimit(limit - 1)"
          >−</button>
          <span class="stepper__value">{{ limit }}</span>
          <button
            class="stepper__btn"
            :disabled="limit >= 999"
            aria-label="增加人数"
            @click="setLimit(limit + 1)"
          >+</button>
        </div>
        <span class="opt-row__label">人</span>
        <button
          v-if="rosterCount > 0 && limit !== rosterCount"
          class="btn btn--ghost btn--xs opt-limit__all"
          @click="useWholeRoster"
        >全部 {{ rosterCount }}</button>
      </div>
      <p class="opt-hint">按抽中人数累计；整组抽出按组内人数算</p>
    </div>
  </div>
</template>

<style scoped>
.opt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
}

.opt-row + .opt-row {
  border-top: 1px solid var(--color-border);
}

.opt-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.opt-row__label {
  font-size: var(--fs-sm);
  color: var(--color-text);
}

.opt-row__desc {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-subtle);
}

.opt-row :deep(.switch) {
  margin-left: auto;
}

.opt-limit {
  margin: 2px 0 4px;
  padding: 10px;
  border-radius: var(--r-md);
  background: var(--color-bg-sunken);
}

.opt-limit__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.opt-limit__all {
  margin-left: auto;
  color: var(--color-primary);
}

.opt-hint {
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-subtle);
}

.stepper--sm {
  border-radius: var(--r-sm);
}

.stepper--sm .stepper__btn {
  width: 26px;
  height: 26px;
  font-size: var(--fs-sm);
}

.stepper--sm .stepper__value {
  min-width: 30px;
  font-size: var(--fs-sm);
  padding: 2px 0;
}
</style>
