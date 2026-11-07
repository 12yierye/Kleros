/**
 * 模态框内视图切换时的高度过渡。
 *
 * 高度是 auto，CSS 无法直接过渡，这里用一次性的 inline height 做 from → to：
 * 测量旧高度 → 切换内容 → 测量新高度 → 固定旧高度 → 下一帧过渡到新高度 → 清理 inline 样式。
 */

import { nextTick, type Ref } from 'vue'

const DURATION_MS = 260
const EASING = 'cubic-bezier(0.33, 1, 0.68, 1)'

/** 强制浏览器计算一次样式，确保刚写入的高度被采用 */
function reflow(el: HTMLElement) {
  void el.offsetHeight
}

/**
 * 高度没有变化空间时（例如弹窗已经顶到 90vh 上限），
 * 用一次轻微的内容淡入让切换有反馈。
 */
function pulseBody(modal: HTMLElement) {
  const body = modal.querySelector<HTMLElement>('.modal__body')
  if (!body) return
  body.classList.remove('modal__body--switch')
  reflow(body)
  body.classList.add('modal__body--switch')
  const done = () => {
    body.classList.remove('modal__body--switch')
    body.removeEventListener('animationend', done)
  }
  body.addEventListener('animationend', done)
}

export function useModalHeight(elRef: Ref<HTMLElement | null>) {
  /** 递增令牌：只有最后一次调用能写样式，避免连续点击时两段动画互相覆盖 */
  let token = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let finishCurrent: (() => void) | null = null

  /** 系统开启「减少动态效果」时不做高度动画 */
  function reducedMotion(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  async function animateHeight(mutate: () => void): Promise<void> {
    const el = elRef.value
    if (!el || reducedMotion()) {
      mutate()
      return
    }

    const my = ++token

    // 上一段过渡没结束：定格在当前视觉高度，再以它为起点继续，避免跳变
    if (finishCurrent) {
      const current = el.offsetHeight
      finishCurrent()
      el.style.transition = 'none'
      el.style.height = `${current}px`
      reflow(el)
    }

    const from = el.offsetHeight
    mutate()
    await nextTick()
    if (my !== token) return

    const target = elRef.value
    if (!target || !target.isConnected) return

    const to = target.offsetHeight
    // 弹窗顶到 90vh 上限时高度没有变化空间，改用内容淡入做反馈
    const cap = window.innerHeight * 0.9
    const bothCapped = from >= cap - 1 && to >= cap - 1
    if (bothCapped || Math.abs(to - from) < 2) {
      target.style.height = ''
      target.style.transition = ''
      pulseBody(target)
      return
    }

    target.style.transition = 'none'
    target.style.height = `${from}px`
    reflow(target)

    // 同一个同步块里开启过渡并写入目标高度：强制回流已经让起始值生效，
    // 浏览器会在下一帧同时应用 transition 与 height，不会跳变
    target.style.transition = `height ${DURATION_MS}ms ${EASING}`
    target.style.height = `${to}px`

    let done = false
    const finish = () => {
      if (done) return
      done = true
      target.removeEventListener('transitionend', onEnd)
      if (timer) { clearTimeout(timer); timer = null }
      target.style.height = ''
      target.style.transition = ''
      finishCurrent = null
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== target || e.propertyName !== 'height') return
      finish()
    }
    target.addEventListener('transitionend', onEnd)
    finishCurrent = finish
    // 兜底：过渡事件丢失时也要收尾
    timer = setTimeout(finish, DURATION_MS + 120)
  }

  return { animateHeight }
}
