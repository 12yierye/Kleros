<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { useUi } from '@/composables/useUi'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useSession } from '@/composables/useSession'
import { usePicker } from '@/composables/usePicker'
import { useSettings } from '@/composables/useSettings'
import { useUpdate } from '@/composables/useUpdate'
import { deleteDB } from '@/composables/useDB'
import { downloadExport } from '@/utils/export'
import { importData } from '@/utils/import'
import { readFileAsText } from '@/utils/nameParser'
import { renderMarkdown } from '@/utils/markdown'
import { UPDATE_SOURCE } from '@/constants'
import ToggleSwitch from './ToggleSwitch.vue'
import HintTip from './HintTip.vue'

const ui = useUi()
const modalRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => ui.state.modal === 'settings')
useFocusTrap(isOpen, modalRef)
const roster = useRoster()
const permanent = usePermanentRoster()
const bw = useBlackWhiteList()
const session = useSession()
const picker = usePicker()
const { prefs, update, reset } = useSettings()

/* 抽取样式切换会展开/收起滚动速度等区域，动画期间先隐藏滚动条 */
let collapseScrollTimer: ReturnType<typeof setTimeout> | null = null
watch(() => prefs.value.pickStyle, () => {
  const el = modalRef.value
  if (!el) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  el.classList.add('modal--height-animating')
  if (collapseScrollTimer) clearTimeout(collapseScrollTimer)
  collapseScrollTimer = setTimeout(() => {
    el.classList.remove('modal--height-animating')
    collapseScrollTimer = null
  }, 300)
})

onBeforeUnmount(() => {
  if (collapseScrollTimer) clearTimeout(collapseScrollTimer)
})

const importMsg = ref<{ ok: boolean; text: string } | null>(null)

const {
  state: updateState,
  release: updateRelease,
  error: updateError,
  currentVersion,
  check: checkUpdate,
} = useUpdate()

/** Release 正文是 Markdown，渲染结果只用于更新卡片内展示 */
const notesHtml = computed(() => renderMarkdown(updateRelease.value?.notes ?? ''))
const releaseDate = computed(() => formatDate(updateRelease.value?.publishedAt))
const downloadUrl = computed(() => updateRelease.value?.downloadUrl ?? UPDATE_SOURCE.releasesPage)

/** 结果在设置面板最底部，检查完把卡片带进视野 */
const updateResultRef = ref<HTMLElement | null>(null)

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function onCheckUpdate() {
  await checkUpdate()
  await nextTick()
  // 结果在面板最底部，检查完把设置面板滚到底，避免卡片被裁在视口外
  const scroller = updateResultRef.value?.closest('.modal__body') as HTMLElement | null
  if (scroller) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  } else {
    updateResultRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

/** 启动时沿用上次布局 */
const rememberLayout = computed({
  get: () => prefs.value.rememberLayout,
  set: (v: boolean) => update('rememberLayout', v),
})

/** 速度滑块的已填充比例（0.1–3） */
const speedProgress = computed(() => {
  const v = Math.min(3, Math.max(0.1, prefs.value.scrollSpeed))
  return `${(((v - 0.1) / 2.9) * 100).toFixed(2)}%`
})

const layouts: { key: 'tabs' | 'stacked' | 'split'; label: string; tip: string }[] = [
  { key: 'tabs', label: '分页', tip: '切换' },
  { key: 'split', label: '横向', tip: '左右' },
  { key: 'stacked', label: '纵向', tip: '上下' },
]

const styles: { key: 'direct' | 'animate'; label: string }[] = [
  { key: 'direct', label: '直接出现' },
  { key: 'animate', label: '滚动选择' },
]

function close() {
  ui.closeModal()
}

/** 滚动速度限制在 0.1–3，保留一位小数 */
function clampSpeed(v: number) {
  if (!Number.isFinite(v)) return 1
  return Math.round(Math.min(3, Math.max(0.1, v)) * 10) / 10
}

/** 分隔符留空即恢复默认（两个空格） */
function normalizeSep(v: string) {
  return v === '' ? '  ' : v
}

function onClearAll() {
  void ui.askConfirm({
    title: '清空全部数据？',
    message: '将删除当前名单、名册、小组、黑白名单、全部抽取记录与偏好，并开启新一轮。此操作不可撤销。',
    danger: true,
    confirmText: '清空',
  }).then(ok => {
    if (!ok) return
    roster.entries.value = []
    roster.groups.value = []
    permanent.clear()
    bw.list.value = { black: [], white: [] }
    session.startNewRound()
    const cur = session.current.value
    if (cur) session.current.value = { ...cur, bundles: [] }
    picker.clearDisplay()
    roster.ensureDefaultGroup()
    reset()
  })
}

function openDBInspect() {
  ui.openModal('dbInspect')
}

function onClearCache() {
  void ui.askConfirm({
    title: '清除缓存？',
    message: '将彻底删除 IndexedDB 数据库，并刷新页面重建。适用于存储结构错乱、数据无法恢复等异常情况。此操作不可撤销。',
    danger: true,
    confirmText: '清除并刷新',
  }).then(async (ok) => {
    if (!ok) return
    try {
      await deleteDB()
    } catch (e) {
      console.warn('deleteDB failed', e)
    }
    window.location.reload()
  })
}

function openGlobalRename() {
  ui.openModal('globalRename')
}

function openIdleTexts() {
  ui.openModal('idleTexts')
}

function onExport() {
  downloadExport()
}

function onImportClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      void ui.askConfirm({
        title: '导入数据？',
        message: '将覆盖全部现有数据（当前名单/名册/黑白名单/抽取记录/偏好），不可撤销。确定导入？',
        danger: true,
        confirmText: '导入',
      }).then(async ok => {
        if (!ok) return
        const result = await importData(text)
        if (result.ok) {
          window.location.reload()
        } else {
          importMsg.value = { ok: false, text: result.error ?? '导入失败' }
        }
      })
    } catch (err) {
      importMsg.value = { ok: false, text: `读取失败：${err instanceof Error ? err.message : String(err)}` }
    }
  }
  input.click()
}
</script>

<template>
<Transition name="modal">
  <div v-if="ui.state.modal === 'settings'" class="modal-backdrop" @click.self="close">
    <div
      ref="modalRef"
      class="modal modal--wide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      tabindex="-1"
    >
      <div class="modal__header">
        <h2 id="settings-dialog-title" class="modal__title">设置</h2>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>

      <div class="modal__body">
        <div class="settings">
          <section class="settings-section">
            <h3 class="settings-section__title">外观</h3>

            <div class="settings-row">
              <span class="settings-row__label">主题</span>
              <div class="settings-row__control settings-swatches">
                <button
                  class="theme-swatch"
                  :class="{ 'theme-swatch--active': prefs.theme !== 'dark' }"
                  @click="update('theme', 'light')"
                >
                  <span class="theme-swatch__dot theme-swatch__dot--light"></span>
                  浅色
                </button>
                <button
                  class="theme-swatch"
                  :class="{ 'theme-swatch--active': prefs.theme === 'dark' }"
                  @click="update('theme', 'dark')"
                >
                  <span class="theme-swatch__dot theme-swatch__dot--dark"></span>
                  深色
                </button>
              </div>
            </div>

          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">界面</h3>

            <div class="settings-row">
              <span class="settings-row__label">
                布局
                <HintTip :text="'分页：两个页面切换\n横向：左右同屏（抽取在左 名单在右）\n纵向：上下同屏（抽取在上 名单在下）'" />
              </span>
              <div class="settings-row__control">
                <div class="radio-group">
                  <span v-for="l in layouts" :key="l.key" class="tip">
                    <button
                      class="radio-group__item"
                      :class="{ 'radio-group__item--active': prefs.layoutMode === l.key }"
                      @click="update('layoutMode', l.key)"
                    >{{ l.label }}</button>
                    <span class="tip__bubble">{{ l.tip }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-row__label">记住布局</span>
              <div class="settings-row__control">
                <ToggleSwitch v-model="rememberLayout" label="记住布局" />
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">抽取</h3>

            <div class="settings-row">
              <span class="settings-row__label">
                抽取方式
                <HintTip text="点一下开始，再点一下停止" />
              </span>
              <div class="settings-row__control">
                <div class="radio-group">
                  <button
                    v-for="s in styles"
                    :key="s.key"
                    class="radio-group__item"
                    :class="{ 'radio-group__item--active': prefs.pickStyle === s.key }"
                    @click="update('pickStyle', s.key)"
                  >{{ s.label }}</button>
                </div>
              </div>
            </div>

            <div
              class="settings-collapse"
              :class="{ 'settings-collapse--closed': prefs.pickStyle !== 'animate' }"
              :inert="prefs.pickStyle !== 'animate'"
            >
              <div class="settings-collapse__inner">
                <div class="settings-row">
                  <span class="settings-row__label">滚动速度</span>
                  <div class="settings-row__control">
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      :value="prefs.scrollSpeed"
                      :style="{ '--range-progress': speedProgress }"
                      @input="update('scrollSpeed', clampSpeed(+($event.target as HTMLInputElement).value))"
                      class="range"
                      aria-label="滚动速度"
                    />
                    <span class="speed-value">×{{ prefs.scrollSpeed.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-row__label">
                分隔符
                <HintTip text="留空恢复两个空格" />
              </span>
              <div class="settings-row__control" style="flex: 1;">
                <input
                  :value="prefs.pickSeparator"
                  @change="update('pickSeparator', normalizeSep(($event.target as HTMLInputElement).value))"
                  class="input"
                  style="max-width: 110px;"
                  placeholder="两个空格"
                  aria-label="多人结果分隔符"
                />
                <button class="btn btn--sm" @click="update('pickSeparator', '  ')">恢复默认</button>
                <span class="sep-preview">张三{{ prefs.pickSeparator }}李四</span>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-row__label">开始按钮</span>
              <div class="settings-row__control" style="flex: 1;">
                <input
                  :value="prefs.startButtonText"
                  @change="update('startButtonText', ($event.target as HTMLInputElement).value || '开始')"
                  class="input"
                  style="max-width: 260px;"
                  placeholder="开始"
                  aria-label="开始按钮文案"
                />
              </div>
            </div>

            <div
              class="settings-collapse"
              :class="{ 'settings-collapse--closed': prefs.pickStyle !== 'animate' }"
              :inert="prefs.pickStyle !== 'animate'"
            >
              <div class="settings-collapse__inner">
                <div class="settings-row">
                  <span class="settings-row__label">停止按钮</span>
                  <div class="settings-row__control" style="flex: 1;">
                    <input
                      :value="prefs.pauseButtonText"
                      @change="update('pauseButtonText', ($event.target as HTMLInputElement).value || '停止')"
                      class="input"
                      style="max-width: 260px;"
                      placeholder="停止"
                      aria-label="停止按钮文案"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-row">
              <span class="settings-row__label">
                空结果文案
                <HintTip text="名单为空时随机显示，启动时重选" />
              </span>
              <div class="settings-row__control">
                <span class="text-subtle" style="font-size: 12px;">{{ prefs.idleTexts?.length ?? 0 }} 条</span>
                <button class="btn btn--sm" @click="openIdleTexts">调整文案</button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">数据</h3>

            <div class="settings-row">
              <span class="settings-row__label">
                备份
                <HintTip text="导入会覆盖现有数据" />
              </span>
              <div class="settings-row__control">
                <button class="btn btn--sm" @click="onExport">导出 JSON</button>
                <button class="btn btn--sm" @click="onImportClick">导入 JSON</button>
              </div>
            </div>
            <div
              v-if="importMsg"
              class="settings-hint"
              role="status"
              aria-live="polite"
              :style="{
                color: importMsg.ok ? 'var(--color-ok-text)' : 'var(--color-warn-text)',
                background: importMsg.ok ? 'var(--color-ok-soft)' : 'var(--color-warn-soft)',
                padding: '4px 8px',
                borderRadius: '4px',
              }"
            >{{ importMsg.text }}</div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">高级</h3>

            <div class="settings-row">
              <span class="settings-row__label">维护</span>
              <div class="settings-row__control" style="flex-wrap: wrap; justify-content: flex-end;">
                <button class="btn btn--sm" @click="openGlobalRename">全局重命名</button>
                <button class="btn btn--sm" @click="openDBInspect">查看数据库</button>
                <button class="btn btn--sm btn--danger" @click="onClearCache">清除缓存</button>
                <button class="btn btn--sm btn--danger" @click="onClearAll">清空全部数据</button>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">关于</h3>

            <div class="settings-row">
              <span class="settings-row__label">
                版本
                <HintTip text="仅点击时联网检查，平时不发请求" />
              </span>
              <div class="settings-row__control">
                <span class="version-tag">v{{ currentVersion }}</span>
                <button
                  class="btn btn--sm"
                  :disabled="updateState === 'checking'"
                  @click="onCheckUpdate"
                >{{ updateState === 'checking' ? '检查中…' : '检查更新' }}</button>
              </div>
            </div>

            <div ref="updateResultRef">
              <div v-if="updateState === 'latest'" class="update-result update-result--ok">
                已是最新版本
              </div>

              <div v-else-if="updateState === 'error'" class="update-result update-result--warn">
                <span>{{ updateError }}</span>
                <a
                  class="update-result__link"
                  :href="UPDATE_SOURCE.releasesPage"
                  target="_blank"
                  rel="noopener noreferrer"
                >打开 GitHub</a>
              </div>

              <div v-else-if="updateState === 'available' && updateRelease" class="update-card">
                <div class="update-card__head">
                  <span class="update-card__version">发现新版本 {{ updateRelease.version }}</span>
                  <span v-if="releaseDate" class="update-card__date">{{ releaseDate }}</span>
                </div>
                <div v-if="notesHtml" class="update-card__notes md-body" v-html="notesHtml"></div>
                <div class="update-card__actions">
                  <a
                    class="btn btn--primary btn--sm"
                    :href="downloadUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >下载新版本</a>
                  <a
                    class="btn btn--sm"
                    :href="updateRelease.pageUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >打开发布页</a>
                </div>
                <p class="update-card__hint">
                  下载后把文件名改回当前文件名、放回同一路径覆盖即可；数据跟着文件走，不会丢。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--primary" @click="close">完成</button>
      </div>
    </div>
  </div>
</Transition>
</template>
