<script setup lang="ts">
import { ref } from 'vue'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import SidePanelSection from './SidePanelSection.vue'

const { list, addBlack, removeBlack, clearBlack } = useBlackWhiteList()

const open = defineModel<boolean>('open', { default: true })
const newName = ref('')

function add() {
  const v = newName.value.trim()
  if (!v) return
  addBlack(v)
  newName.value = ''
}
</script>

<template>
  <SidePanelSection id="blacklist" title="黑名单" :count="list.black.length" v-model:open="open">
    <div class="chip-list" style="margin-bottom: 8px;">
      <span
        v-for="n in list.black"
        :key="n"
        class="chip chip--black"
        :title="n"
      >
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeBlack(n)" aria-label="移除">×</button>
      </span>
      <span v-if="list.black.length === 0" class="text-subtle" style="font-size: 12px;">
        暂无黑名单成员
      </span>
    </div>
    <div style="display: flex; gap: 4px;">
      <input
        v-model="newName"
        class="input"
        placeholder="输入名字后回车"
        @keyup.enter="add"
        style="flex: 1;"
      />
      <button class="btn" @click="add">加入</button>
      <button
        v-if="list.black.length"
        class="btn btn--ghost"
        @click="clearBlack"
        title="清空"
      >
        清空
      </button>
    </div>
  </SidePanelSection>
</template>
