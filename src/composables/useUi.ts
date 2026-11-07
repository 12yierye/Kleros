/**
 * 纯 UI 状态（侧栏折叠、模态框开关等）
 * 通过 provide/inject 在 App 树内共享
 */

import { reactive, inject, provide, type InjectionKey } from 'vue'
import type { UserPreferences } from '@/types/settings'

export type ModalKind =
  | 'settings'
  | 'rename'
  | 'globalRename'
  | 'dbInspect'
  | 'bundles'
  | 'library'
  | 'idleTexts'
  | 'confirm'
  | null

export type SideView = 'filters' | 'options'

export interface ConfirmState {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

export interface UiState {
  sideCollapsed: boolean
  sideView: SideView
  modal: ModalKind
  renameTargetUid: string | null
  renameTargetFrom: 'roster' | 'permanent' | null
  confirm: ConfirmState | null
}

export interface UiApi {
  state: UiState
  toggleSide(): void
  showSideView(view: SideView): void
  openBundles(): void
  openModal(kind: Exclude<ModalKind, null>): void
  closeModal(): void
  openRename(uidVal: string, from: 'roster' | 'permanent'): void
  askConfirm(opts: Omit<ConfirmState, 'resolve'>): Promise<boolean>
}

const KEY: InjectionKey<UiApi> = Symbol('kleros.ui')

export function provideUi(): UiApi {
  const state = reactive<UiState>({
    sideCollapsed: false,
    sideView: 'filters',
    modal: null,
    renameTargetUid: null,
    renameTargetFrom: null,
    confirm: null,
  })

  /**
   * 模态框栈：设置里打开「全局重命名」等子框，关掉子框要回到设置，
   * 单值 modal 会让设置直接消失。stack 里只存非 null 值。
   */
  const stack: Exclude<ModalKind, null>[] = []

  const api: UiApi = {
    state,
    toggleSide() {
      state.sideCollapsed = !state.sideCollapsed
    },
    showSideView(view) {
      state.sideView = view
      state.sideCollapsed = false
    },
    openBundles() {
      api.openModal('bundles')
    },
    openModal(kind) {
      if (stack[stack.length - 1] === kind) return
      stack.push(kind)
      state.modal = kind
    },
    closeModal() {
      stack.pop()
      state.modal = stack[stack.length - 1] ?? null
    },
    openRename(uidVal, from) {
      state.renameTargetUid = uidVal
      state.renameTargetFrom = from
      api.openModal('rename')
    },
    askConfirm(opts) {
      return new Promise<boolean>((resolve) => {
        state.confirm = { ...opts, resolve }
      })
    },
  }

  provide(KEY, api)
  return api
}

export function useUi(): UiApi {
  const api = inject(KEY)
  if (!api) throw new Error('useUi must be used within provideUi()')
  return api
}

/** 桥接 UserPreferences 中侧栏相关字段到 UI state */
export function syncSidePanel(ui: UiApi, prefs: UserPreferences) {
  ui.state.sideCollapsed = prefs.sidePanelCollapsed
}
