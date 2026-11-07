import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'
import { renameSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** 版本号只认 package.json，避免构建产物文件名与版本不同步 */
const VERSION = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version as string

function renameHtml(): Plugin {
  return {
    name: 'rename-html',
    apply: 'build',
    // closeBundle 在所有插件写盘之后执行，避免和 singlefile 的输出顺序打架
    closeBundle() {
      try {
        renameSync(resolve('dist', 'index.html'), resolve('dist', `Kleros ${VERSION}.html`))
      } catch {}
    },
  }
}

function fixFileUrlHtml(): Plugin {
  return {
    name: 'fix-file-url',
    enforce: 'post',
    transformIndexHtml(html) {
      let result = html
        .replace(/<link [^>]*rel="icon"[^>]*\/?>/g, '')
        .replace(/ type="module" crossorigin/g, ' defer')
        .replace(/ rel="stylesheet" crossorigin/g, '')

      const m = result.match(/<script defer src="[^"]*"><\/script>/)
      if (m) {
        result = result.replace(m[0], '')
        result = result.replace('</body>', '  ' + m[0] + '\n</body>')
      }
      return result
    },
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [
    vue(),
    viteSingleFile(),
    ...(command === 'build' ? [fixFileUrlHtml(), renameHtml()] : []),
    {
      name: 'fix-dev-base',
      apply: 'serve',
      enforce: 'post',
      config(config) {
        config.base = '/'
      },
    },
  ],
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
}))
