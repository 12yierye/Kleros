<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { matchName } from '@/utils/pinyin'

const props = withDefaults(defineProps<{
  exclude?: string[]
  placeholder?: string
}>(), {
  exclude: () => [],
  placeholder: '搜索名字…',
})

const emit = defineEmits<{ (e: 'pick', name: string): void }>()

const open = ref(false)
const q = ref('')
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const pos = ref({ top: 0, left: 0, width: 250 })

const roster = useRoster()
const lib = usePermanentRoster()

const candidates = computed(() => {
  const seen = new Set<string>()
  const out: { name: string; from: string }[] = []
  for (const e of lib.entries.value) {
    if (seen.has(e.name)) continue
    seen.add(e.name)
    out.push({ name: e.name, from: '名册' })
  }
  for (const e of roster.entries.value) {
    if (seen.has(e.name)) continue
    seen.add(e.name)
    out.push({ name: e.name, from: '当前名单' })
  }
  const exclude = new Set(props.exclude)
  return out.filter(c => !exclude.has(c.name) && matchName(c.name, q.value))
})

const available = computed(() => candidates.value.length)

function place() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const width = Math.max(r.width, 252)
  const height = panelRef.value?.offsetHeight || 262
  let left = r.left
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
  let top = r.bottom + 6
  if (top + height > window.innerHeight - 8) top = Math.max(8, r.top - height - 6)
  pos.value = { top, left, width }
}

async function toggle() {
  if (open.value) { close(); return }
  place()
  open.value = true
  q.value = ''
  await nextTick()
  inputRef.value?.focus()
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
  document.addEventListener('mousedown', onOutside, true)
}

function close() {
  open.value = false
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('mousedown', onOutside, true)
}

/**
 * 滚动时面板跟随触发器，而不是直接关闭。
 * 候选列表自身滚动一定不能关，否则搜完想看下面的结果，面板就没了。
 */
function onScroll(e: Event) {
  const t = e.target
  if (t instanceof Node && panelRef.value?.contains(t)) return
  const el = triggerRef.value
  if (!el || !el.isConnected) { close(); return }
  const r = el.getBoundingClientRect()
  if (r.bottom <= 0 || r.top >= window.innerHeight) { close(); return }
  place()
}

function onResize() {
  close()
}

function onOutside(e: MouseEvent) {
  const t = e.target as Node
  if (panelRef.value?.contains(t)) return
  if (triggerRef.value?.contains(t)) return
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onBeforeUnmount(close)
</script>

<template>
  <div class="name-picker">
    <button ref="triggerRef" class="btn btn--sm btn--block name-picker__trigger" @click="toggle">
      <span>＋ 选择成员</span>
    </button>

    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="open"
          ref="panelRef"
          class="name-picker__panel"
          :style="{ top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }"
          @keydown="onKey"
        >
          <input
            ref="inputRef"
            v-model="q"
            class="input"
            :placeholder="placeholder"
          />
          <div class="name-picker__list">
            <button
              v-for="c in candidates"
              :key="c.name"
              class="name-picker__item"
              @click="emit('pick', c.name)"
            >
              <span class="ellipsis">{{ c.name }}</span>
              <span class="name-picker__from">{{ c.from }}</span>
            </button>
            <div v-if="candidates.length === 0" class="name-picker__empty">
              {{ q.trim() ? '没有匹配的人' : '没有可选的人' }}
            </div>
          </div>
          <div class="name-picker__foot">
            <span class="text-subtle" style="font-size: 11px;">点名字直接加入（{{ available }}）</span>
            <span class="flex-1"></span>
            <button class="btn btn--xs" @click="close">完成</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
