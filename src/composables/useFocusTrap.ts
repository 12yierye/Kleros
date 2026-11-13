import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** 多个弹窗叠开（如确认框盖在设置上）时，只让最上层接管 Tab */
const trapStack: symbol[] = []

export function useFocusTrap(isOpen: Ref<boolean>, rootRef: Ref<HTMLElement | null>) {
  const trapId = Symbol('focus-trap')

  function removeFromStack() {
    const index = trapStack.lastIndexOf(trapId)
    if (index >= 0) trapStack.splice(index, 1)
  }

  function focusables(): HTMLElement[] {
    if (!rootRef.value) return []
    return Array.from(rootRef.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isOpen.value || e.key !== 'Tab') return
    if (trapStack[trapStack.length - 1] !== trapId) return
    const root = rootRef.value
    if (!root) return

    const list = focusables()
    if (list.length === 0) {
      e.preventDefault()
      return
    }

    const first = list[0]
    const last = list[list.length - 1]
    const active = document.activeElement

    if (!root.contains(active)) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
      return
    }

    if (e.shiftKey) {
      if (active === first || active === root) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  watch(
    isOpen,
    (open) => {
      if (open) {
        if (trapStack[trapStack.length - 1] !== trapId) trapStack.push(trapId)
        void nextTick(() => {
          const root = rootRef.value
          if (!root) return
          const preferred = root.querySelector<HTMLElement>('[data-autofocus]')
          ;(preferred ?? root).focus()
        })
      } else {
        removeFromStack()
        // 关闭后不回到触发按钮：把焦点交还页面，不再给原按钮补焦点环
        if (rootRef.value?.contains(document.activeElement)) {
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }
    },
    { immediate: true }
  )

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    removeFromStack()
  })
}
