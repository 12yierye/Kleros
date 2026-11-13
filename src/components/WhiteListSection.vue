<script setup lang="ts">
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useUi } from '@/composables/useUi'
import NamePicker from './NamePicker.vue'

const { list, addWhite, removeWhite, clearWhite } = useBlackWhiteList()
const ui = useUi()

function onClear() {
  if (list.value.white.length === 0) return
  void ui.askConfirm({
    title: '清空白名单？',
    message: `将移除 ${list.value.white.length} 个名字，抽取范围会恢复到全部成员。此操作不可撤销。`,
    danger: true,
    confirmText: '清空',
  }).then(ok => { if (ok) clearWhite() })
}
</script>

<template>
  <div class="panel-block">
    <div class="panel-block__head">
      <span class="panel-block__title">白名单</span>
      <span class="panel-block__count">{{ list.white.length }}</span>
      <span class="flex-1"></span>
      <button v-if="list.white.length" class="btn btn--xs btn--ghost" @click="onClear">清空</button>
    </div>
    <p class="panel-block__hint">留空不限；有人时只抽这些人</p>

    <TransitionGroup name="chip-fade" tag="div" class="chip-list">
      <span v-for="n in list.white" :key="n" class="chip chip--white" :title="n">
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeWhite(n)" aria-label="移除">×</button>
      </span>
    </TransitionGroup>

    <NamePicker :exclude="list.white" placeholder="搜索只允许抽的人（可拼音）…" @pick="addWhite" />
  </div>
</template>
