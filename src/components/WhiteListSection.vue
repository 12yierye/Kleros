<script setup lang="ts">
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import NamePicker from './NamePicker.vue'

const { list, addWhite, removeWhite, clearWhite } = useBlackWhiteList()
</script>

<template>
  <div class="panel-block">
    <div class="panel-block__head">
      <span class="panel-block__title">白名单</span>
      <span class="panel-block__count">{{ list.white.length }}</span>
      <span class="flex-1"></span>
      <button v-if="list.white.length" class="btn btn--xs btn--ghost" @click="clearWhite">清空</button>
    </div>
    <p class="panel-block__hint">留空不限；有人时只抽这些人</p>

    <div class="chip-list">
      <span v-for="n in list.white" :key="n" class="chip chip--white" :title="n">
        <span class="chip__name">{{ n }}</span>
        <button class="chip__close" @click="removeWhite(n)" aria-label="移除">×</button>
      </span>
    </div>

    <NamePicker :exclude="list.white" placeholder="搜索只允许抽的人（可拼音）…" @pick="addWhite" />
  </div>
</template>
