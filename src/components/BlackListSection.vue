<script setup lang="ts">
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import NamePicker from './NamePicker.vue'

const { list, addBlack, removeBlack, clearBlack } = useBlackWhiteList()
</script>

<template>
  <div class="panel-block">
    <div class="panel-block__head">
      <span class="panel-block__title">黑名单</span>
      <span class="panel-block__count">{{ list.black.length }}</span>
      <span class="flex-1"></span>
      <button v-if="list.black.length" class="btn btn--xs btn--ghost" @click="clearBlack">清空</button>
    </div>
    <p class="panel-block__hint">这些人不会被抽到</p>

    <div class="chip-list">
      <span v-for="n in list.black" :key="n" class="chip chip--black" :title="n">
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeBlack(n)" aria-label="移除">×</button>
      </span>
    </div>

    <NamePicker :exclude="list.black" placeholder="搜索要排除的人…" @pick="addBlack" />
  </div>
</template>
