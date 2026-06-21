<script setup lang="ts">
import { ref } from 'vue'
import { useUi } from '@/composables/useUi'
import { useRoster } from '@/composables/useRoster'
import { usePermanentRoster } from '@/composables/usePermanentRoster'
import { useBlackWhiteList } from '@/composables/useBlackWhiteList'
import { useSession } from '@/composables/useSession'
import { useSettings } from '@/composables/useSettings'
import { downloadExport } from '@/utils/export'
import { readFileAsJSON, importData } from '@/utils/import'

const ui = useUi()
const roster = useRoster()
const permanent = usePermanentRoster()
const bw = useBlackWhiteList()
const session = useSession()
const { prefs, update, reset } = useSettings()

const importMsg = ref<{ ok: boolean; text: string } | null>(null)

function close() {
  ui.closeModal()
}

function onClearAll() {
  void ui.askConfirm({
    title: '清空全部数据？',
    message: '将删除临时/常驻名单、黑白名单、会话历史、用户偏好。此操作不可撤销。',
    danger: true,
    confirmText: '清空',
  }).then(ok => {
    if (!ok) return
    roster.clear()
    permanent.clear()
    bw.clearBlack()
    bw.clearWhite()
    session.clearAllHistory()
    reset()
  })
}

function openGlobalRename() {
  ui.openModal('globalRename')
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
      const text = await readFileAsJSON(file)
      void ui.askConfirm({
        title: '导入数据？',
        message: '将覆盖全部现有数据（临时/常驻/黑白名单/会话/偏好），不可撤销。确定导入？',
        danger: true,
        confirmText: '导入',
      }).then(ok => {
        if (!ok) return
        const result = importData(text)
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
    <div class="modal">
      <div class="modal__header">
        <span>设置</span>
        <button class="btn btn--ghost btn--icon" @click="close" aria-label="关闭">×</button>
      </div>
      <div class="modal__body">
        <div class="field">
          <label class="field__label">历史上限</label>
          <input
            type="number"
            min="1"
            :value="prefs.historyLimit"
            @change="update('historyLimit', Math.max(1, +($event.target as HTMLInputElement).value || 50))"
            class="input"
            style="width: 120px;"
          />
          <div class="field__hint">超出后最早的会话将被压缩为概要</div>
        </div>

        <div class="field">
          <label class="field__label">主题</label>
          <div class="radio-group">
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.theme === 'light' }" @click="update('theme', 'light')">浅色</button>
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.theme === 'dark' }" @click="update('theme', 'dark')" disabled>深色（即将支持）</button>
          </div>
        </div>

        <div class="field">
          <label class="field__label">动画速度</label>
          <div class="radio-group">
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.animationSpeed === 'off' }" @click="update('animationSpeed', 'off')">关闭</button>
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.animationSpeed === 'fast' }" @click="update('animationSpeed', 'fast')">快</button>
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.animationSpeed === 'normal' }" @click="update('animationSpeed', 'normal')">正常</button>
            <button class="radio-group__item" :class="{ 'radio-group__item--active': prefs.animationSpeed === 'slow' }" @click="update('animationSpeed', 'slow')">慢</button>
          </div>
        </div>

        <div class="field">
          <label class="field__label">开始/暂停按钮文本</label>
          <div style="display: flex; gap: 8px;">
            <input
              :value="prefs.startButtonText"
              @change="update('startButtonText', ($event.target as HTMLInputElement).value || '开始抽取')"
              class="input"
              placeholder="开始抽取"
              style="flex: 1;"
            />
            <input
              :value="prefs.pauseButtonText"
              @change="update('pauseButtonText', ($event.target as HTMLInputElement).value || '看看是谁')"
              class="input"
              placeholder="看看是谁"
              style="flex: 1;"
            />
          </div>
          <div class="field__hint">左：开始 · 右：暂停查看</div>
        </div>

        <div class="field">
          <label class="checkbox">
            <input
              type="checkbox"
              :checked="prefs.rememberLayout"
              @change="update('rememberLayout', ($event.target as HTMLInputElement).checked)"
            />
            记住视图模式（关闭则每次启动回到标签模式）
          </label>
        </div>

        <div class="field">
          <label class="field__label">数据</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn" @click="onExport">导出 JSON</button>
            <button class="btn" @click="onImportClick">导入 JSON</button>
          </div>
          <div
            v-if="importMsg"
            :style="{
              marginTop: '8px',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              background: importMsg.ok ? '#e7f7ee' : '#fff5e6',
              color: importMsg.ok ? '#2bb673' : '#b56e00',
            }"
          >{{ importMsg.text }}</div>
          <div class="field__hint">导出全部数据为 JSON 文件；导入将覆盖当前全部数据</div>
        </div>

        <div class="field">
          <label class="field__label">高级</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn" @click="openGlobalRename">全局重命名…</button>
            <button class="btn btn--danger" @click="onClearAll">清空全部数据</button>
          </div>
          <div class="field__hint">全局重命名：搜索所有 UID 中显示名匹配的人，可勾选是否同步历史</div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--primary" @click="close">完成</button>
      </div>
    </div>
  </div>
</Transition>
</template>
