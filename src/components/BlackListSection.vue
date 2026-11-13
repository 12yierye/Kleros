<script setup lang="ts">
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useUi } from '@/composables/useUi'
import NamePicker from './NamePicker.vue'

const { list, addBlack, removeBlack, clearBlack } = useBlackWhiteList()
const ui = useUi()

function onClear() {
  if (list.value.black.length === 0) return
  void ui.askConfirm({
    title: '清空黑名单？',
    message: `将移除 ${list.value.black.length} 个名字，这些人会重新参与抽取。此操作不可撤销。`,
    danger: true,
    confirmText: '清空',
  }).then(ok => { if (ok) clearBlack() })
}
</script>

<template>
  <div class="panel-block">
    <div class="panel-block__head">
      <span class="panel-block__title">黑名单</span>
      <span class="panel-block__count">{{ list.black.length }}</span>
      <span class="flex-1"></span>
      <button v-if="list.black.length" class="btn btn--xs btn--ghost" @click="onClear">清空</button>
    </div>
    <p class="panel-block__hint">这些人不会被抽到</p>

    <TransitionGroup name="chip-fade" tag="div" class="chip-list">
      <span v-for="n in list.black" :key="n" class="chip chip--black" :title="n">
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeBlack(n)" aria-label="移除">×</button>
      </span>
    </TransitionGroup>

    <NamePicker :exclude="list.black" placeholder="搜索要排除的人（可拼音）…" @pick="addBlack" />
  </div>
</template>
