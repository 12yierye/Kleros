<script setup lang="ts">
import { computed } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { usePicker } from '@/composables/usePicker'
import { useSession } from '@/composables/useSession'

const { entries: roster } = useRoster()
const { entries: permanent } = usePermanentRoster()
const { blackCount, whiteCount } = useBlackWhiteList()
const { poolSize } = usePicker()
const { totalPickedThisSession, history } = useSession()

const stats = computed(() => ({
  pool: poolSize.value,
  roster: roster.value.length,
  permanent: permanent.value.length,
  black: blackCount.value,
  white: whiteCount.value,
  picked: totalPickedThisSession.value,
  historyCount: history.value.length,
}))
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__stats">
      <span>可抽 <b>{{ stats.pool }}</b></span>
      <span>临时 <b>{{ stats.roster }}</b></span>
      <span>常驻 <b>{{ stats.permanent }}</b></span>
      <span>黑 <b>{{ stats.black }}</b></span>
      <span>白 <b>{{ stats.white }}</b></span>
      <span>本会话已抽 <b>{{ stats.picked }}</b></span>
      <span>历史 <b>{{ stats.historyCount }}</b></span>
    </div>
    <div class="text-subtle">Kleros v1.0</div>
  </footer>
</template>
