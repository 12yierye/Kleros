/**
 * 用户偏好（持久化到 localStorage）
 */

export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow'
export type LayoutMode = 'tabs' | 'stacked' | 'split'
export type PickStyle = 'direct' | 'animate'

export interface UserPreferences {
  /** 动画速度 */
  animationSpeed: AnimationSpeed
  /** 当前会话内已抽过的人不再被抽 */
  noRepeatInSession: boolean
  /** 左侧栏是否折叠 */
  sidePanelCollapsed: boolean
  /** 左侧栏各 Section 折叠状态：key 为 section id */
  sidePanelSections: Record<string, boolean>
  /** 历史上限（默认 50） */
  historyLimit: number
  /** 抽 N 人后自动开新会话（0 = 仅手动） */
  autoNewSessionAfter: number
  /** 主题（首版仅 light） */
  theme: 'light' | 'dark'
  /** 主界面布局：标签页 / 上下堆叠 / 左右分栏 */
  layoutMode: LayoutMode
  /** 是否记住视图模式（关闭则每次启动回到标签模式） */
  rememberLayout: boolean
  /** 抽取风格：直接抽取 / 动画抽取 */
  pickStyle: PickStyle
  /** 开始抽取按钮文本 */
  startButtonText: string
  /** 暂停/查看按钮文本 */
  pauseButtonText: string
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  animationSpeed: 'off',
  noRepeatInSession: true,
  sidePanelCollapsed: false,
  sidePanelSections: {
    blacklist: false,
    whitelist: false,
    pickOptions: false,
    history: true,
  },
  historyLimit: 50,
  autoNewSessionAfter: 0,
  theme: 'light',
  layoutMode: 'tabs',
  rememberLayout: true,
  pickStyle: 'direct',
  startButtonText: '开始抽取',
  pauseButtonText: '看看是谁',
}
