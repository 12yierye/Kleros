/**
 * 用户偏好（持久化到 IndexedDB）
 */

export type LayoutMode = 'tabs' | 'stacked' | 'split'
export type PickStyle = 'direct' | 'animate'
/** 抽取口径：按人（各自独立）/ 按小组（小组成员一起出） */
export type DrawMode = 'person' | 'group'

export interface UserPreferences {
  /** 偏好结构版本，用于一次性迁移 */
  prefsVersion?: number
  /** 滚动抽取速率：0.1–3，1 为基准 */
  scrollSpeed: number
  /** 当前轮次内已抽过的人不再被抽 */
  noRepeatInSession: boolean
  /** 左侧栏是否折叠 */
  sidePanelCollapsed: boolean
  /** 抽 N 人后自动换轮（0 = 仅手动） */
  autoNewSessionAfter: number
  /** 主题 */
  theme: 'light' | 'dark'
  /** 主界面布局：分页 / 上下堆叠 / 左右分栏 */
  layoutMode: LayoutMode
  /** 是否记住视图模式 */
  rememberLayout: boolean
  /** 抽取方式：直接出结果 / 滚动动画 */
  pickStyle: PickStyle
  /** 抽取口径：按人 / 按小组 */
  drawMode: DrawMode
  /** 多人结果的分隔符（默认两个空格） */
  pickSeparator: string
  /** 开始抽取按钮文本 */
  startButtonText: string
  /** 暂停/查看按钮文本 */
  pauseButtonText: string
  /** 没有可抽的人时，结果区随机展示的文案（空数组 = 用默认） */
  idleTexts: string[]
}

/** 空结果文案默认值：每次启动随机显示一条 */
export const DEFAULT_IDLE_TEXTS = [
  '名单还是空的',
  '还没有人可抽',
  '先把名字放进来吧',
  '空空如也',
  '这里静悄悄的',
  '等一个人来',
]

export const PREFS_VERSION = 4

export const DEFAULT_PREFERENCES: UserPreferences = {
  prefsVersion: PREFS_VERSION,
  scrollSpeed: 1,
  noRepeatInSession: true,
  sidePanelCollapsed: false,
  autoNewSessionAfter: 0,
  theme: 'light',
  layoutMode: 'tabs',
  rememberLayout: true,
  pickStyle: 'direct',
  drawMode: 'person',
  pickSeparator: '  ',
  startButtonText: '开始抽取',
  pauseButtonText: '看看是谁',
  idleTexts: [...DEFAULT_IDLE_TEXTS],
}
