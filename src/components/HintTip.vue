<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="hint">
    <button type="button" class="hint__btn" aria-label="说明">?</button>
    <span class="hint__bubble" role="tooltip">{{ text }}</span>
  </span>
</template>

<style scoped>
.hint {
  position: relative;
  display: inline-flex;
  margin-left: 5px;
  vertical-align: middle;
}

.hint__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-subtle);
  font-size: 10px;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.hint__btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
  background: var(--color-chip-bg-hover);
}

.hint__bubble {
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  z-index: 70;
  width: max-content;
  max-width: 240px;
  padding: 7px 10px;
  border-radius: var(--r-sm);
  background: var(--tip-bg);
  color: var(--tip-fg);
  font-size: 11px;
  line-height: 1.55;
  text-align: left;
  /* pre-line：保留文本里的换行，同时允许自动折行 */
  white-space: pre-line;
  box-shadow: var(--sh-md);
  opacity: 0;
  visibility: hidden;
  transform: translate(-3px, -50%);
  transition: opacity 0.14s ease, transform 0.14s ease, visibility 0.14s;
  pointer-events: none;
}

.hint:hover .hint__bubble,
.hint:focus-within .hint__bubble {
  opacity: 1;
  visibility: visible;
  transform: translate(0, -50%);
}
</style>
