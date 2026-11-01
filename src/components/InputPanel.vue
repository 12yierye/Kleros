<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { parseNamesFromText, parseNamesFromCSV, readFileAsText } from '@/utils/nameParser'
import type { PermanentGroup } from '@/types/roster'

const roster = useRoster()
const lib = usePermanentRoster()

const bookList = computed(() => lib.groups.value.filter(g => g.members.length > 0))

function addFromBook(g: PermanentGroup) {
  const r = roster.addMany(g.members.map(m => m.name))
  showMsg(
    r.added > 0 ? 'ok' : 'warn',
    r.added > 0 ? `已从「${g.name}」加入 ${r.added} 人` : `「${g.name}」里的人都已经在当前名单`
  )
}

type Tab = 'paste' | 'manual' | 'file'
const tab = ref<Tab>('paste')

const pasteText = ref('')
const manualText = ref('')
const message = ref<{ kind: 'ok' | 'warn'; text: string } | null>(null)


function showMsg(kind: 'ok' | 'warn', text: string) {
  message.value = { kind, text }
  setTimeout(() => {
    if (message.value?.text === text) message.value = null
  }, 4000)
}

function doParse(text: string, csv: boolean) {
  const result = csv ? parseNamesFromCSV(text) : parseNamesFromText(text)
  if (result.names.length === 0) {
    showMsg('warn', '未解析到任何名字')
    return
  }
  const { added, duplicates } = roster.addMany(result.names, { groupId: roster.activeGroupId.value })
  const parts: string[] = []
  parts.push(`已加入 ${added} 人`)
  if (duplicates > 0) parts.push(`跳过重名 ${duplicates} 人`)
  if (result.dropped.length > 0) parts.push(`丢弃 ${result.dropped.length} 项`)
  showMsg(added > 0 ? 'ok' : 'warn', parts.join('，'))
}

function onAddToRoster() {
  doParse(pasteText.value, false)
  pasteText.value = ''
}

function onAddOneManual() {
  const v = manualText.value.trim()
  if (!v) return
  const r = roster.addMany([v], { groupId: roster.activeGroupId.value })
  if (r.added > 0) {
    showMsg('ok', `已加入 1 人`)
    manualText.value = ''
  } else {
    showMsg('warn', '已存在同名')
  }
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await readFileAsText(file)
    const isCsv = /\.csv$/i.test(file.name)
    doParse(text, isCsv)
  } catch (err) {
    showMsg('warn', `读取失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    input.value = ''
  }
}

</script>

<template>
  <div class="add-block">
    <div v-if="bookList.length > 0" class="add-from-book">
      <span class="add-from-book__label">从名册加入</span>
      <button
        v-for="g in bookList"
        :key="g.id"
        class="btn btn--xs"
        @click="addFromBook(g)"
      >{{ g.name }} · {{ g.members.length }}</button>
    </div>

    <div class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': tab === 'paste' }"
        @click="tab = 'paste'"
      >粘贴</button>
      <button
        class="tab"
        :class="{ 'tab--active': tab === 'manual' }"
        @click="tab = 'manual'"
      >手动</button>
      <button
        class="tab"
        :class="{ 'tab--active': tab === 'file' }"
        @click="tab = 'file'"
      >文件</button>
    </div>

    <div v-if="tab === 'paste'">
      <textarea
        v-model="pasteText"
        class="textarea"
        placeholder="空行 空格 逗号 分号 制表符 均可分隔"
      />
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <button class="btn btn--primary" @click="onAddToRoster" :disabled="!pasteText.trim()">
          解析并加入
        </button>
        <button class="btn btn--ghost" @click="pasteText = ''" :disabled="!pasteText">清空输入</button>
      </div>
    </div>

    <div v-else-if="tab === 'manual'">
      <div style="display: flex; gap: 8px;">
        <input
          v-model="manualText"
          class="input"
          placeholder="输入一个人名后回车加入"
          @keyup.enter="onAddOneManual"
        />
        <button class="btn btn--primary" @click="onAddOneManual" :disabled="!manualText.trim()">加入</button>
      </div>
      <div class="text-subtle" style="font-size: 12px; margin-top: 6px;">逐个加入，适合临时补一个人</div>
    </div>

    <div v-else>
      <label
        style="display: block; padding: 24px; border: 2px dashed var(--color-border-strong); border-radius: 8px; text-align: center; cursor: pointer;"
      >
        <input type="file" accept=".txt,.csv" @change="onFile" style="display: none;" />
        <div class="text-muted">点击选择 .txt / .csv 文件</div>
        <div class="text-subtle" style="font-size: 12px; margin-top: 4px;">CSV 仅取每行第一列</div>
      </label>
    </div>

    <Transition name="toast">
    <div
      v-if="message"
      :style="{
        marginTop: '12px',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        background: message.kind === 'ok' ? 'var(--color-ok-soft)' : 'var(--color-warn-soft)',
        color: message.kind === 'ok' ? 'var(--color-ok-text)' : 'var(--color-warn-text)',
      }"
    >{{ message.text }}</div>
    </Transition>
  </div>
</template>
