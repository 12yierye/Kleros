var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';
import { renameSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** 版本号只认 package.json，避免构建产物文件名与版本不同步 */
var VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
function renameHtml() {
    return {
        name: 'rename-html',
        apply: 'build',
        // closeBundle 在所有插件写盘之后执行，避免和 singlefile 的输出顺序打架
        closeBundle: function () {
            try {
                renameSync(resolve('dist', 'index.html'), resolve('dist', "Kleros ".concat(VERSION, ".html")));
            }
            catch (_a) { }
        },
    };
}
function fixFileUrlHtml() {
    return {
        name: 'fix-file-url',
        enforce: 'post',
        transformIndexHtml: function (html) {
            var result = html
                .replace(/<link [^>]*rel="icon"[^>]*\/?>/g, '')
                .replace(/ type="module" crossorigin/g, ' defer')
                .replace(/ rel="stylesheet" crossorigin/g, '');
            var m = result.match(/<script defer src="[^"]*"><\/script>/);
            if (m) {
                result = result.replace(m[0], '');
                result = result.replace('</body>', '  ' + m[0] + '\n</body>');
            }
            return result;
        },
    };
}
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        base: command === 'build' ? './' : '/',
        plugins: __spreadArray(__spreadArray([
            vue(),
            viteSingleFile()
        ], (command === 'build' ? [fixFileUrlHtml(), renameHtml()] : []), true), [
            {
                name: 'fix-dev-base',
                apply: 'serve',
                enforce: 'post',
                config: function (config) {
                    config.base = '/';
                },
            },
        ], false),
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
    });
});
