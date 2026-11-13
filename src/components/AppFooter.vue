<script setup lang="ts">
import { computed } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { usePicker } from '@/composables/usePicker'
import { useFilePersistence } from '@/composables/useFilePersistence'

const { entries: roster } = useRoster()
const { entries: permanent } = usePermanentRoster()
const { blackCount, whiteCount } = useBlackWhiteList()
const { poolSize } = usePicker()
const { fileLabel } = useFilePersistence()

const stats = computed(() => ({
  pool: poolSize.value,
  roster: roster.value.length,
  permanent: permanent.value.length,
  black: blackCount.value,
  white: whiteCount.value,
}))
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__stats">
      <span>可抽 <b>{{ stats.pool }}</b></span>
      <span>当前 <b>{{ stats.roster }}</b></span>
      <span>名册 <b>{{ stats.permanent }}</b></span>
      <span>黑名单 <b>{{ stats.black }}</b></span>
      <span>白名单 <b>{{ stats.white }}</b></span>
    </div>
    <div class="app-footer__file-status">
      {{ fileLabel }}
    </div>
  </footer>
</template>
