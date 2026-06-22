/**
 * 抽取主逻辑（单例）
 */

import { ref, computed } from 'vue'
import { useRoster } from './useRoster'
import { usePermanentRoster } from './usePermanentRoster'
import { useBlackWhiteList } from './useBlackWhiteList'
import { useSession } from './useSession'
import { useSettings } from './useSettings'
import { buildCandidatePool, pickOne, pickMany, type CandidateItem } from '@/utils/pick'
import type { PickMode } from '@/types/session'

let _instance: ReturnType<typeof createPicker> | undefined

function createPicker() {
  const { entries: roster, crossGroup, activeGroupId } = useRoster()
  const { entries: permanent } = usePermanentRoster()
  const { list } = useBlackWhiteList()
  const { current, appendPick } = useSession()
  const { prefs } = useSettings()

  const isPicking = ref(false)
  const isAnimating = ref(false)
  const blockAttempt = ref(false)
  const lastResults = ref<CandidateItem[]>([])
  const lastError = ref<string | null>(null)

  const pool = computed<CandidateItem[]>(() => {
    if (!current.value) return []
    const filteredRoster = crossGroup.value
      ? roster.value
      : roster.value.filter(e => e.groupId === activeGroupId.value)
    return buildCandidatePool({
      roster: filteredRoster,
      permanent: permanent.value,
      list: list.value,
      session: current.value,
      prefs: prefs.value,
    })
  })

  const poolSize = computed(() => pool.value.length)

  async function trigger(opts: { mode: PickMode; count: number }): Promise<CandidateItem[] | null> {
    lastError.value = null
    if (isPicking.value) return null
    isPicking.value = true
    try {
      const available = pool.value
      if (available.length === 0) {
        lastError.value = '候选池为空：请先添加名单或检查黑白名单设置'
        return null
      }
      if (opts.mode === 'multi' && opts.count > available.length) {
        opts = { ...opts, count: available.length }
      }
      const results =
        opts.mode === 'single'
          ? (() => {
              const r = pickOne(available)
              return r ? [r] : []
            })()
          : pickMany(available, opts.count)

      await onAnimTick(results, prefs.value.animationSpeed)

      appendPick(results.map(r => r.uid), opts.mode)
      roster.value = roster.value.map(r =>
        results.some(x => x.uid === r.uid)
          ? { ...r, pickedThisSession: true }
          : r
      )

      lastResults.value = results
      return results
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e)
      return null
    } finally {
      isPicking.value = false
    }
  }

  function startAnimate() {
    lastError.value = null
    if (isPicking.value) return
    isPicking.value = true
    isAnimating.value = true
  }

  function commitAnimatePick(item: CandidateItem) {
    lastResults.value = [item]
    appendPick([item.uid], 'single')
    roster.value = roster.value.map(r =>
      r.uid === item.uid ? { ...r, pickedThisSession: true } : r
    )
    isPicking.value = false
    isAnimating.value = false
  }

  return {
    isPicking, isAnimating, blockAttempt,
    lastResults, lastError, pool, poolSize,
    trigger, startAnimate, commitAnimatePick,
  }
}

export function usePicker() {
  if (!_instance) _instance = createPicker()
  return _instance
}

/** 动画钩子占位：首版直接 resolve，后续扩展 */
async function onAnimTick(
  _results: CandidateItem[],
  _speed: 'off' | 'fast' | 'normal' | 'slow'
): Promise<void> {
  return Promise.resolve()
}
