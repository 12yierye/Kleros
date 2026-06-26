export const STORAGE_KEYS = {
  ROSTER_TEMP: 'kleros.roster.temporary',
  ROSTER_PERMANENT: 'kleros.roster.permanent',
  LISTS_BW: 'kleros.lists.bw',
  SESSION_CURRENT: 'kleros.session.current',
  SESSION_HISTORY: 'kleros.session.history',
  PREFS: 'kleros.prefs',
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
