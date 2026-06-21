<script setup lang="ts">
import { useSettings } from '@/composables/useSettings'
import SidePanelSection from './SidePanelSection.vue'

const { prefs, update } = useSettings()

const open = defineModel<boolean>('open', { default: true })

function setNoRepeat(v: boolean) {
  update('noRepeatInSession', v)
}
</script>

<template>
  <SidePanelSection id="pickOptions" title="抽取参数" v-model:open="open">
    <label class="checkbox" style="margin-bottom: 8px;">
      <input
        type="checkbox"
        :checked="prefs.noRepeatInSession"
        @change="setNoRepeat(($event.target as HTMLInputElement).checked)"
      />
      本会话内已抽过的不再抽
    </label>

    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
      <span class="text-muted">抽 N 人后自动开新会话</span>
      <input
        type="number"
        min="0"
        :value="prefs.autoNewSessionAfter"
        @change="update('autoNewSessionAfter', Math.max(0, +($event.target as HTMLInputElement).value || 0))"
        class="input"
        style="width: 80px;"
        title="0 = 仅手动"
      />
    </div>
    <div class="text-subtle" style="font-size: 11px; margin-top: 4px;">0 表示仅手动开启新会话</div>
  </SidePanelSection>
</template>
