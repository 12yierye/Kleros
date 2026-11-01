/**
 * 本轮抽取状态
 * - 只有一份「本轮」：抽了谁、绑定小组
 * - 开始新一轮 = 清空抽取记录，绑定小组保留
 */

import { watch, computed, type Ref } from 'vue'
import { useDB } from './useDB'
import { useSettings } from './useSettings'
import { uid } from '@/utils/id'
import { STORAGE_KEYS, UID_PREFIX } from '@/constants'
import type { Round, PickMode, PickRecord } from '@/types/session'
import type { Bundle, BundleMember } from '@/types/bundle'

/** 旧版本把小组存在 relations / bindingGroups 字段里，且带 mode（可能含已废弃的互斥） */
interface LegacyBundle {
  id: string
  name?: string
  color?: string
  members?: BundleMember[]
  createdAt?: number
  mode?: string
}
type LegacyRound = Round & {
  relations?: LegacyBundle[]
  bindingGroups?: LegacyBundle[]
}

/** 把旧结构（relations / bindingGroups，可能含已废弃的互斥）统一成绑定小组 */
export function normalizeBundles(input: unknown): Bundle[] {
  if (!Array.isArray(input)) return []
  return (input as LegacyBundle[])
    .filter(g => !!g && typeof g === 'object' && g.mode !== 'mutex')
    .map(g => ({
      id: g.id,
      name: g.name ?? '未命名小组',
      color: g.color ?? '#4A90D9',
      members: Array.isArray(g.members) ? g.members : [],
      createdAt: g.createdAt ?? Date.now(),
    }))
}

let _current: Ref<Round | null> | undefined

function getCurrent() {
  if (!_current) _current = useDB<Round | null>(STORAGE_KEYS.SESSION_CURRENT, null)
  return _current
}

/** 新一轮开始后的回调（用于清掉名单上的「已抽」标记等） */
type NewRoundListener = () => void
const newRoundListeners: NewRoundListener[] = []

export function onNewRound(fn: NewRoundListener) {
  if (!newRoundListeners.includes(fn)) newRoundListeners.push(fn)
}

export function useSession() {
  const current = getCurrent()
  const { prefs } = useSettings()

  const totalPickedThisSession = computed(() => current.value?.totalPicked ?? 0)

  function startNewRound() {
    const keepBundles = current.value?.bundles ?? []
    current.value = {
      id: uid(UID_PREFIX.SESSION),
      startedAt: Date.now(),
      picks: [],
      totalPicked: 0,
      bundles: keepBundles,
    }
    for (const fn of newRoundListeners) fn()
  }

  /** 启动时确保有一份可用的本轮状态（旧数据可能缺字段） */
  function ensureRound() {
    const cur = current.value as LegacyRound | null
    if (!cur || !Array.isArray(cur.picks)) {
      startNewRound()
      return
    }

    const patch: Partial<Round> = {}

    if (!Array.isArray(cur.bundles)) {
      const legacy = Array.isArray(cur.relations)
        ? cur.relations
        : Array.isArray(cur.bindingGroups)
          ? cur.bindingGroups
          : []
      patch.bundles = normalizeBundles(legacy)
    }

    if (typeof cur.totalPicked !== 'number') {
      patch.totalPicked = cur.picks.reduce((sum, p) => sum + p.uids.length, 0)
    }

    if (Object.keys(patch).length > 0) {
      const next = { ...cur, ...patch } as Round & { relations?: unknown; bindingGroups?: unknown }
      // 旧字段已迁移，落库前剔除，避免一直残留
      delete next.relations
      delete next.bindingGroups
      current.value = next
    } else if ('relations' in cur || 'bindingGroups' in cur) {
      const next = { ...cur } as Round & { relations?: unknown; bindingGroups?: unknown }
      delete next.relations
      delete next.bindingGroups
      current.value = next
    }
  }

  function appendPick(uids: string[], mode: PickMode) {
    if (!current.value) return
    const rec: PickRecord = { time: Date.now(), mode, uids: [...uids] }
    current.value.picks.push(rec)
    current.value.totalPicked += uids.length
  }

  function undoToPick(pickIndex: number): string[] | null {
    if (!current.value) return null
    if (pickIndex < 0 || pickIndex >= current.value.picks.length) return null
    const undone = current.value.picks.slice(pickIndex).flatMap(p => p.uids)
    current.value.picks = current.value.picks.slice(0, pickIndex)
    current.value.totalPicked = current.value.picks.reduce((sum, p) => sum + p.uids.length, 0)
    return undone
  }

  /** 抽满 N 人后自动重置本轮（0 = 关闭） */
  let lastSeen = 0
  watch(totalPickedThisSession, (n) => {
    const threshold = prefs.value.autoNewSessionAfter
    if (threshold > 0 && lastSeen < threshold && n >= threshold) {
      startNewRound()
      lastSeen = 0
      return
    }
    lastSeen = n
  })

  function initLastSeen() {
    lastSeen = totalPickedThisSession.value
  }

  return {
    current,
    totalPickedThisSession,
    startNewRound,
    ensureRound,
    appendPick,
    undoToPick,
    initLastSeen,
  }
}
