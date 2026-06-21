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
} as const

export const LIMITS = {
  HISTORY_MIN: 1,
  HISTORY_DEFAULT: 50,
  AUTO_SESSION_DEFAULT: 0,
  MULTI_PICK_MIN: 1,
  MULTI_PICK_MAX: 99,
  TOAST_DURATION_MS: 4000,
} as const
