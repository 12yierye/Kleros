import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'
import { renameSync } from 'node:fs'
import { resolve } from 'node:path'

const VERSION = '1.1'

const OUTPUT_HTML_NAME = 'Kleros.html'

function renameHtml(): Plugin {
  return {
    name: 'rename-html',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      try {
        renameSync(resolve(outDir, `Kleros ${VERSION}.html`), resolve(outDir, OUTPUT_HTML_NAME))
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
