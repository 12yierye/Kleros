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
  | 'bindingGroups'
  | 'confirm'
  | null

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
  modal: ModalKind
  renameTargetUid: string | null
  renameTargetFrom: 'roster' | 'permanent' | null
  confirm: ConfirmState | null
}

export interface UiApi {
  state: UiState
  toggleSide(): void
  openModal(kind: Exclude<ModalKind, null>): void
  closeModal(): void
  openRename(uidVal: string, from: 'roster' | 'permanent'): void
  askConfirm(opts: Omit<ConfirmState, 'resolve'>): Promise<boolean>
}

const KEY: InjectionKey<UiApi> = Symbol('kleros.ui')

export function provideUi(): UiApi {
  const state = reactive<UiState>({
    sideCollapsed: false,
    modal: null,
    renameTargetUid: null,
    renameTargetFrom: null,
    confirm: null,
  })

  const api: UiApi = {
    state,
    toggleSide() {
      state.sideCollapsed = !state.sideCollapsed
    },
    openModal(kind) {
      state.modal = kind
    },
    closeModal() {
      state.modal = null
    },
    openRename(uidVal, from) {
      state.renameTargetUid = uidVal
      state.renameTargetFrom = from
      state.modal = 'rename'
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
