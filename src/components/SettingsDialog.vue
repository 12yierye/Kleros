<script setup lang="ts">
import { ref } from 'vue'
import { useUi } from '@/composables/useUi'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useSession } from '@/composables/useSession'
import { usePicker } from '@/composables/usePicker'
import { useSettings } from '@/composables/useSettings'
import { deleteDB } from '@/composables/useDB'
import { downloadExport } from '@/utils/export'
import { importData } from '@/utils/import'
import { readFileAsText } from '@/utils/nameParser'

const ui = useUi()
const roster = useRoster()
const permanent = usePermanentRoster()
const bw = useBlackWhiteList()
const session = useSession()
const picker = usePicker()
const { prefs, update, reset } = useSettings()

const importMsg = ref<{ ok: boolean; text: string } | null>(null)

const layouts: { key: 'tabs' | 'stacked' | 'split'; label: string; tip: string }[] = [
  { key: 'tabs', label: '分页', tip: '抽取与名单切换查看' },
  { key: 'split', label: '横向', tip: '左右并排：左抽取 · 右名单' },
  { key: 'stacked', label: '纵向', tip: '上下堆叠：上抽取 · 下名单' },
]

const styles: { key: 'direct' | 'animate'; label: string }[] = [
  { key: 'direct', label: '直接出结果' },
  { key: 'animate', label: '滚动动画' },
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
    <div class="modal modal--wide">
      <div class="modal__header">
        <span>设置</span>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>

      <div class="modal__body">
        <div class="settings">
          <section class="settings-section">
            <div class="settings-section__title">外观</div>

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
            <div class="settings-section__title">界面</div>

            <div class="settings-row">
              <span class="settings-row__label">布局</span>
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
            <p class="settings-hint">分页：两个页面切换 · 横向：左右同屏 · 纵向：上下同屏</p>

            <div class="settings-row">
              <span class="settings-row__label">启动时</span>
              <div class="settings-row__control">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    :checked="prefs.rememberLayout"
                    @change="update('rememberLayout', ($event.target as HTMLInputElement).checked)"
                  />
                  沿用上次布局
                </label>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section__title">抽取</div>

            <div class="settings-row">
              <span class="settings-row__label">抽取方式</span>
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
            <p class="settings-hint">滚动动画：点一下开始滚名字，再点一下定格；多人时并排滚动</p>

            <div class="settings-row">
              <span class="settings-row__label">滚动速度</span>
              <div class="settings-row__control">
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  :value="prefs.scrollSpeed"
                  @input="update('scrollSpeed', clampSpeed(+($event.target as HTMLInputElement).value))"
                  class="range"
                  aria-label="滚动速度"
                />
                <span class="speed-value">×{{ prefs.scrollSpeed.toFixed(1) }}</span>
              </div>
            </div>
            <p class="settings-hint">0.1 – 3.0，默认 1.0；数值越大滚得越快</p>

            <div class="settings-row">
              <span class="settings-row__label">分隔符</span>
              <div class="settings-row__control" style="flex: 1;">
                <input
                  :value="prefs.pickSeparator"
                  @change="update('pickSeparator', normalizeSep(($event.target as HTMLInputElement).value))"
                  class="input"
                  style="max-width: 110px;"
                  placeholder="两个空格"
                />
                <button class="btn btn--sm" @click="update('pickSeparator', '  ')">恢复默认</button>
                <span class="sep-preview">张三{{ prefs.pickSeparator }}李四</span>
              </div>
            </div>
            <p class="settings-hint">同时抽中多人时的分隔；默认两个空格，留空也按两个空格处理</p>

            <div class="settings-row">
              <span class="settings-row__label">按钮文案</span>
              <div class="settings-row__control" style="flex: 1;">
                <input
                  :value="prefs.startButtonText"
                  @change="update('startButtonText', ($event.target as HTMLInputElement).value || '开始抽取')"
                  class="input"
                  placeholder="开始抽取"
                />
                <input
                  :value="prefs.pauseButtonText"
                  @change="update('pauseButtonText', ($event.target as HTMLInputElement).value || '看看是谁')"
                  class="input"
                  placeholder="看看是谁"
                />
              </div>
            </div>
            <p class="settings-hint">左：开始 · 右：滚动动画停下的按钮</p>

            <div class="settings-row">
              <span class="settings-row__label">空结果文案</span>
              <div class="settings-row__control">
                <span class="text-subtle" style="font-size: 12px;">{{ prefs.idleTexts?.length ?? 0 }} 条</span>
                <button class="btn btn--sm" @click="openIdleTexts">调整文案</button>
              </div>
            </div>
            <p class="settings-hint">没有可抽的人时，结果区随机显示其中一条；每次启动重新随机</p>
          </section>

          <section class="settings-section">
            <div class="settings-section__title">数据</div>

            <div class="settings-row">
              <span class="settings-row__label">备份</span>
              <div class="settings-row__control">
                <button class="btn btn--sm" @click="onExport">导出 JSON</button>
                <button class="btn btn--sm" @click="onImportClick">导入 JSON</button>
              </div>
            </div>
            <p class="settings-hint">导出全部数据；导入会覆盖现有数据</p>
            <div
              v-if="importMsg"
              class="settings-hint"
              :style="{
                color: importMsg.ok ? 'var(--color-ok-text)' : 'var(--color-warn-text)',
                background: importMsg.ok ? 'var(--color-ok-soft)' : 'var(--color-warn-soft)',
                padding: '4px 8px',
                borderRadius: '4px',
              }"
            >{{ importMsg.text }}</div>
          </section>

          <section class="settings-section">
            <div class="settings-section__title">高级</div>

            <div class="settings-row">
              <span class="settings-row__label">维护</span>
              <div class="settings-row__control" style="flex-wrap: wrap; justify-content: flex-end;">
                <button class="btn btn--sm" @click="openGlobalRename">全局重命名</button>
                <button class="btn btn--sm" @click="openDBInspect">查看数据库</button>
                <button class="btn btn--sm btn--danger" @click="onClearCache">清除缓存</button>
                <button class="btn btn--sm btn--danger" @click="onClearAll">清空全部数据</button>
              </div>
            </div>
            <p class="settings-hint">全局重命名：按名字批量替换 · 清除缓存：抹除全部存储并刷新</p>
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
