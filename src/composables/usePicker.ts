/**
 * 抽取主逻辑（单例）
 */

import { ref, computed, watch } from 'vue'
import { useRoster } from './useRoster'
import { usePermanentRoster } from './usePermanentRoster'
import { useBlackWhiteList } from './useBlackWhiteList'
import { useSession } from './useSession'
import { useSettings } from './useSettings'
import { buildCandidatePool, pickFrom, type CandidateItem } from '@/utils/pick'
import type { PickMode } from '@/types/session'

let _instance: ReturnType<typeof createPicker> | undefined

function createPicker() {
  const { entries: roster } = useRoster()
  const { entries: permanent } = usePermanentRoster()
  const { list } = useBlackWhiteList()
  const { current, appendPick, undoToPick } = useSession()
  const { prefs } = useSettings()

  const isPicking = ref(false)
  const isAnimating = ref(false)
  const blockAttempt = ref(false)
  const lastResults = ref<CandidateItem[]>([])
  const lastError = ref<string | null>(null)
  /** 结果区展示的 uid：只在真正抽过之后才有值，不随轮次重置被清空 */
  const displayUids = ref<string[]>([])
  /** 名字实时解析，名单改名 / 异步载入后都会跟着更新 */
  const displayNames = computed(() => displayUids.value.map(nameOf))

  /** 抽取人数（按人口径=人数，按小组口径=签数） */
  const count = ref(1)

  const pool = computed<CandidateItem[]>(() => {
    if (!current.value) return []
    return buildCandidatePool({
      roster: roster.value,
      permanent: permanent.value,
      list: list.value,
      session: current.value,
      prefs: prefs.value,
    })
  })

  const poolSize = computed(() => pool.value.length)
  const effectiveCount = computed(() =>
    Math.max(1, Math.min(count.value, Math.max(1, poolSize.value)))
  )

  function dec() { count.value = Math.max(1, count.value - 1) }
  function inc() { count.value = Math.min(99, count.value + 1) }

  function nameOf(uidVal: string): string {
    const r = roster.value.find(e => e.uid === uidVal) ?? permanent.value.find(e => e.uid === uidVal)
    return r?.name ?? uidVal.slice(-6)
  }

  function applyResults(results: CandidateItem[], mode: PickMode) {
    appendPick(results.map(r => r.uid), mode)
    const set = new Set(results.map(r => r.uid))
    roster.value = roster.value.map(r =>
      set.has(r.uid) ? { ...r, pickedThisSession: true } : r
    )
    lastResults.value = results
    displayUids.value = results.map(r => r.uid)
  }

  /** 撤销后：结果区回退到上一条记录的名字，没有记录就清空 */
  function syncDisplayFromPicks() {
    const picks = current.value?.picks ?? []
    const last = picks[picks.length - 1]
    displayUids.value = last ? [...last.uids] : []
  }

  function clearDisplay() {
    displayUids.value = []
  }

  function draw(n: number): CandidateItem[] {
    const available = pool.value
    if (available.length === 0) return []
    const want = Math.min(Math.max(1, n), available.length)
    return pickFrom(
      available,
      want,
      current.value?.bundles ?? [],
      prefs.value.drawMode
    )
  }

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
      const want = opts.mode === 'single' ? 1 : opts.count
      const results = draw(want)

      applyResults(results, opts.mode)
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

  /** 滚动停下：按当前人数与口径正式抽取并入账 */
  function stopAnimate(n: number): CandidateItem[] {
    const results = draw(n)
    isAnimating.value = false
    isPicking.value = false
    if (results.length === 0) {
      lastError.value = '候选池为空：请先添加名单或检查黑白名单设置'
      return []
    }
    applyResults(results, results.length > 1 ? 'multi' : 'single')
    return results
  }

  // 刷新 / 启动后恢复上一条记录的名字，避免只剩「可抽 N 人」
  watch(
    () => current.value?.picks.length ?? 0,
    (len) => {
      if (len > 0 && displayUids.value.length === 0) syncDisplayFromPicks()
    },
    { immediate: true }
  )

  /** 撤销到第 index 条记录之前（含该条），返回是否成功 */
  function undoTo(index: number): boolean {
    const undone = undoToPick(index)
    if (!undone) return false
    const set = new Set(undone)
    for (const e of roster.value) {
      if (set.has(e.uid)) e.pickedThisSession = false
    }
    lastResults.value = []
    lastError.value = null
    syncDisplayFromPicks()
    return true
  }

  return {
    isPicking, isAnimating, blockAttempt,
    lastResults, lastError, displayNames, pool, poolSize,
    count, effectiveCount, dec, inc,
    trigger, startAnimate, stopAnimate, undoTo, clearDisplay,
  }
}

export function usePicker() {
  if (!_instance) _instance = createPicker()
  return _instance
}
