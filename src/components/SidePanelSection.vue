<script setup lang="ts">
interface Props {
  id: string
  title: string
  count?: number
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  defaultOpen: true,
})

const open = defineModel<boolean>('open', { default: true })
</script>

<template>
  <section
    class="side-section"
    :class="{ 'side-section--collapsed': !open }"
  >
    <button
      class="side-section__header"
      @click="open = !open"
      :aria-expanded="open"
    >
      <span class="side-section__header-left">
        <span>{{ props.title }}</span>
        <span v-if="props.count > 0" class="side-section__count">({{ props.count }})</span>
      </span>
      <span class="side-section__caret">▼</span>
    </button>
    <div v-show="open" class="side-section__body">
      <slot />
    </div>
  </section>
</template>
