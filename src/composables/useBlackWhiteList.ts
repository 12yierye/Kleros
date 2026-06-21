/**
 * 黑白名单（localStorage）
 * 按 name 字符串存储，不跟随 UID 重命名
 */

import { computed, type Ref } from 'vue'
import { useStorage } from './useStorage'
import { STORAGE_KEYS } from '@/constants'
import type { BlackWhiteList } from '@/types/list'

let _list: Ref<BlackWhiteList> | undefined
function getList() {
  if (!_list) _list = useStorage<BlackWhiteList>(STORAGE_KEYS.LISTS_BW, { black: [], white: [] }, 'local')
  return _list
}

export function useBlackWhiteList() {
  const list = getList()

  const blackCount = computed(() => list.value.black.length)
  const whiteCount = computed(() => list.value.white.length)

  function isBlack(name: string): boolean {
    return list.value.black.includes(name)
  }

  function isWhite(name: string): boolean {
    return list.value.white.length > 0 && list.value.white.includes(name)
  }

  function addBlack(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (list.value.black.includes(trimmed)) return
    list.value.black.push(trimmed)
  }

  function removeBlack(name: string) {
    list.value.black = list.value.black.filter(n => n !== name)
  }

  function addWhite(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (list.value.white.includes(trimmed)) return
    list.value.white.push(trimmed)
  }

  function removeWhite(name: string) {
    list.value.white = list.value.white.filter(n => n !== name)
  }

  function clearBlack() {
    list.value.black = []
  }

  function clearWhite() {
    list.value.white = []
  }

  return {
    list,
    blackCount,
    whiteCount,
    isBlack,
    isWhite,
    addBlack,
    removeBlack,
    addWhite,
    removeWhite,
    clearBlack,
    clearWhite,
  }
}
