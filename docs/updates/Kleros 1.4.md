### 🐛 修复

- **修正多分组命名不一致**：`ensureDefaultGroup()` 中当存在多个分组时，第一个分组不再错误命名为「临时名单1」，修正为「临时名单」，后续分组从「临时名单2」起递增，与 `addGroup()` 命名规则一致。
- **修复构建产物重命名失效**：`vite.config.ts` 中 `renameHtml` 插件原先将文件重命名为自身（死操作），修正为将 `index.html` 重命名为 `Kleros 1.4.html`，使构建输出文件名与版本号匹配。

### 🔧 优化

- **消除重复计算**：`RosterPanel.vue` 模板中 `groupForRosterAllMembers()` 在同一渲染周期被调用 4 次，每次遍历所有互斥组与名单条目。改为 `computed` 缓存结果，模板改用 `Map.get()`（O(1) 查找）替代 O(n*m) 重复计算。
- **合并重复工具函数**：`import.ts` 与 `nameParser.ts` 中定义了功能完全相同的文件读取函数（`readFileAsJSON` / `readFileAsText`），统一为 `nameParser.ts` 中的 `readFileAsText`，消除代码冗余。
- **清理未使用导入**：移除 `SettingsDialog.vue` 中导入但从未调用的 `clearAllDB`。
