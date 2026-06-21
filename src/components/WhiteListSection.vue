<script setup lang="ts">
import { ref } from 'vue'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import SidePanelSection from './SidePanelSection.vue'

const { list, addWhite, removeWhite, clearWhite } = useBlackWhiteList()

const open = defineModel<boolean>('open', { default: true })
const newName = ref('')

function add() {
  const v = newName.value.trim()
  if (!v) return
  addWhite(v)
  newName.value = ''
}
</script>

<template>
  <SidePanelSection id="whitelist" title="白名单" :count="list.white.length" v-model:open="open">
    <div class="chip-list" style="margin-bottom: 8px;">
      <span
        v-for="n in list.white"
        :key="n"
        class="chip chip--white"
        :title="n"
      >
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeWhite(n)" aria-label="移除">×</button>
      </span>
      <span v-if="list.white.length === 0" class="text-subtle" style="font-size: 12px;">
        留空表示所有人可抽；填写后只从白名单抽
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
        v-if="list.white.length"
        class="btn btn--ghost"
        @click="clearWhite"
        title="清空"
      >
        清空
      </button>
    </div>
  </SidePanelSection>
</template>
