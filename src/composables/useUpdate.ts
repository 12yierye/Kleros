/**
 * 手动检查更新
 *
 * 只读 GitHub 的 /releases/latest：没有启动检查、没有轮询、不记录任何东西。
 * 只有用户点「检查更新」时才发一次请求，失败就如实报错并留一个发布页入口。
 */

import { ref } from 'vue'
import { APP_VERSION, UPDATE_SOURCE } from '@/constants'
import { isNewerVersion } from '@/utils/version'

export type UpdateState = 'idle' | 'checking' | 'latest' | 'available' | 'error'

export interface ReleaseInfo {
  version: string
  title: string
  publishedAt: string
  notes: string
  downloadUrl: string | null
  pageUrl: string
}

const REQUEST_TIMEOUT_MS = 12000

interface GithubRelease {
  tag_name?: string
  name?: string
  body?: string
  published_at?: string
  html_url?: string
  assets?: { name?: string; browser_download_url?: string }[]
}

/** 自定义错误：只有这类错误的 message 会原样展示给用户 */
class UpdateError extends Error {}

const state = ref<UpdateState>('idle')
const release = ref<ReleaseInfo | null>(null)
const error = ref('')

function pickAsset(assets: GithubRelease['assets']): string | null {
  const list = Array.isArray(assets) ? assets : []
  const html = list.find((a) => typeof a?.name === 'string' && /\.html?$/i.test(a.name))
  const chosen = html ?? list[0]
  return typeof chosen?.browser_download_url === 'string' ? chosen.browser_download_url : null
}

function describeFailure(err: unknown): string {
  if (err instanceof UpdateError) return err.message
  if ((err as { name?: string } | null)?.name === 'AbortError') {
    return '请求超时，检查网络后重试'
  }
  return '连不上 GitHub，可能是网络问题，或浏览器拦了本地文件的跨域请求'
}

async function check(): Promise<void> {
  if (state.value === 'checking') return
  state.value = 'checking'
  error.value = ''
  release.value = null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    // 带时间戳绕过任何缓存；GitHub API 只认 GET，无自定义头，不会触发预检
    const res = await fetch(`${UPDATE_SOURCE.latestApi}?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (res.status === 403 || res.status === 429) {
      throw new UpdateError('GitHub 接口限流了，过一会儿再试')
    }
    if (res.status === 404) {
      throw new UpdateError('仓库里还没有已发布的版本')
    }
    if (!res.ok) {
      throw new UpdateError(`GitHub 返回 ${res.status}`)
    }

    const data = (await res.json()) as GithubRelease
    const version = String(data.tag_name ?? '').trim()
    if (!version) {
      throw new UpdateError('没解析到版本号，GitHub 返回的内容可能变了')
    }

    release.value = {
      version: version.replace(/^v/i, ''),
      title: data.name?.trim() || `Kleros ${version}`,
      publishedAt: typeof data.published_at === 'string' ? data.published_at : '',
      notes: typeof data.body === 'string' ? data.body : '',
      downloadUrl: pickAsset(data.assets),
      pageUrl: data.html_url?.trim() || UPDATE_SOURCE.releasesPage,
    }

    state.value = isNewerVersion(version, APP_VERSION) ? 'available' : 'latest'
  } catch (err) {
    state.value = 'error'
    error.value = describeFailure(err)
  } finally {
    clearTimeout(timer)
  }
}

export function useUpdate() {
  return { state, release, error, currentVersion: APP_VERSION, check }
}
