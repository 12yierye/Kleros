export const STORAGE_KEYS = {
  ROSTER_TEMP: 'kleros.roster.temporary',
  ROSTER_PERMANENT: 'kleros.roster.permanent',
  LISTS_BW: 'kleros.lists.bw',
  SESSION_CURRENT: 'kleros.session.current',
  PREFS: 'kleros.prefs',
} as const

/**
 * 当前版本号：构建时由 vite.config.ts 从 package.json 注入。
 * 回落到 0.0.0 只可能发生在配置被改坏、define 没生效的构建里。
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

/** 更新只认已发布的 release，不读开发分支上的 package.json */
export const UPDATE_SOURCE = {
  repo: '12yierye/Kleros',
  latestApi: 'https://api.github.com/repos/12yierye/Kleros/releases/latest',
  releasesPage: 'https://github.com/12yierye/Kleros/releases',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const UID_PREFIX = {
  ROSTER: 'r_',
  PERMANENT: 'p_',
  SESSION: 's_',
  GROUP: 'g_',
  BINDING: 'b_',
} as const

export const LIMITS = {
  HISTORY_MIN: 1,
  HISTORY_DEFAULT: 50,
  AUTO_SESSION_DEFAULT: 0,
  MULTI_PICK_MIN: 1,
  MULTI_PICK_MAX: 99,
  TOAST_DURATION_MS: 4000,
} as const

export const BINDING_GROUP_COLORS = [
  '#E76F51',
  '#F4A261',
  '#E9C46A',
  '#2A9D8F',
  '#264653',
  '#5A7BD8',
  '#9B5DE5',
  '#FF6B9D',
] as const

export type BindingGroupColor = (typeof BINDING_GROUP_COLORS)[number]

/**
 * 名册默认取色。
 * 与小组的默认色（BINDING_GROUP_COLORS[0] 橙）错开，避免一个颜色同时代表两种归属。
 */
export const BOOK_COLORS = [
  '#2A9D8F',
  '#5A7BD8',
  '#9B5DE5',
  '#E9C46A',
  '#264653',
  '#F4A261',
  '#FF6B9D',
  '#E76F51',
] as const
