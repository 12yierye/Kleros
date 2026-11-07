> Kleros 1.5 · 发布于 2026-11-01 · 本次为 UI 与抽取内核的大幅重构版本，含不兼容变更，升级前请先阅读「升级注意事项」。

### ✨ 新增功能

- **暗色主题**：设置 → 外观 → 主题，可切换浅色/深色。基于 CSS 变量 + `<html data-theme>` 实现，切换即时生效、不写业务数据，偏好随 `prefs.theme` 持久化。
- **滚动抽取动画正式落地**：`PickerStage.vue` 改为多列滚动（reel），滚动由 CSS `@keyframes` + `translate3d` 驱动（无 JS 定时器抖动），列数/字号按候选人数自适应，上下边缘渐隐。
  - 抽取方式 `pickStyle`：`direct` 直接出结果 / `animate` 滚动动画；
  - 速率 `scrollSpeed` 由档位改为 **0.1–3 的数值**（×1 为基准），设置中可拖动调节；
  - 空格键开始 / 暂停（输入框内与弹窗打开时不响应），滚动停止时才正式入账。
- **三种主界面布局**：`layoutMode` 支持 **标签页（tabs）/ 上下堆叠（stacked）/ 左右分栏（split）**，在设置中切换；`rememberLayout` 关闭时每次启动回到标签页模式。
- **名册库（Library）**：顶栏新增「名册」入口（`LibraryDialog.vue`），名册从右侧名单面板剥离，统一在此管理。
  - 名册改为**分组结构**：新建 / 重命名 / 删除名册分组，每组独立取色（`BOOK_COLORS`）；
  - 支持整册加入当前名单、单人 `＋` 加入、成员编辑（关键词搜索、按来源分组全选），删除走二次确认。
- **绑定分组 → 绑定小组（Bundles）**：语义统一为「同组的人一起被抽中」，支持新建 / 改名 / 改色 / 增删成员 / 拆散；小组需 ≥2 人，成员不足会自动解散；支持跨轮保留。
- **抽取口径 `drawMode`**：`person` 按人（各自独立）/ `group` 按小组（小组整体入选并占对应名额；单抽抽到小组时整组一起出）。
- **抽取记录独立区块**：`PickerHistory.vue` 倒序展示本轮记录（时间 / 人数 / 姓名），悬停可「↶ 撤销」到该条之前，区域超高自动滚动。
- **成员选择器**：`NamePicker.vue` 可搜索浮层，黑白名单添加改为从「当前名单 + 名册」合并候选中点选（自动去重、Esc / 点击外部关闭）。
- **通用开关组件**：`ToggleSwitch.vue`，用于「本轮不重复」「抽 N 人后自动开始新一轮」等开关。
- **多人结果分隔符可配置**：设置中新增 `pickSeparator`（默认两个空格），实时预览「张三␣␣李四」。

### 🔧 优化

- **主界面结构重构**：`App.vue` 改为 `header / body / footer` 三行网格；侧栏折叠为 56px 图标轨；窄屏（≤900px）自动收起且**不写入偏好**，避免污染桌面端的布局记忆。
- **名单面板职责收敛**：`RosterPanel.vue` 只管「当前名单」（含多分组与批量操作），名册相关操作全部走顶栏名册弹窗；批量转移的目标可直接选名册分组。
- **抽取算法抽离到 `utils/pick.ts`**：候选池合并当前名单与名册 → **按姓名去重** → 黑白名单过滤 → 本轮已抽过滤（uid + name 双集合）→ 按小组口径整组屏蔽；抽样统一走 Fisher-Yates。
- **结果展示改为按 UID 实时解析**：`displayUids` / `displayNames` 让改名、异步载入后结果自动跟随；刷新/启动后恢复上一条抽取结果的姓名，而非只剩「可抽 N 人」。
- **撤销粒度细化**：`undoTo(index)` 可撤销到任意一条记录（含该条），同步回退 `pickedThisSession` 灰态与结果区显示。
- **会话模型简化**：由「当前会话 + 历史会话栈」收敛为单一「本轮」`Round`，删除 `useSessionManager.ts`；抽取记录只存 UID，`totalPicked` 缓存避免重算。
- **常驻名单分组化**：`usePermanentRoster.ts` 升级为 `PermanentGroup[]`，新增 `addGroup / renameGroup / deleteGroup / addMembers / setMembers / importMany / replaceAll` 等批量接口，旧扁平数据自动归入默认组，`entries` 仍为拉平计算属性，候选池与重命名逻辑无需改动。
- **键盘与弹窗**：空格开始/暂停、`Esc` 逐层关闭弹窗与确认框。
- **样式体系整理**：`base / layout / components` 三段拆分，暗色变量集中管理；`NameChip` 支持归属色点与来源 tooltip；底部统计条展示名册数、黑白名单数、本轮已抽人数与文件持久化状态。
- **启动时序修正**：等待 `dbReady` 后再执行 `normalizePrefs()` → `ensureRound()` → `ensureDefaultGroup()`，避免 IndexedDB 异步载入导致的状态错乱。

### 🐛 修复

- 修正当前名单与名册中**同名的人被重复计入候选池**（导致被抽概率翻倍）：候选池改为按姓名去重。
- 修正本轮已抽过滤只按 UID 判断、**改名或跨名单同名时仍会被再次抽中**：改为 uid + name 双集合过滤。
- 修正刷新后结果区不显示上次抽中者：新增 `syncDisplayFromPicks()`，从最后一条记录恢复展示。
- 修正撤销后结果区与名单「已抽」灰态不同步：撤销统一回退 UID 集合与展示状态。
- 修正旧数据中 `relations` / `bindingGroups` 字段残留导致小组读取失败：`normalizeBundles()` 统一归一化，并在落库前剔除旧字段。
- 修正侧栏折叠状态刷新即还原：UI 状态与 `prefs.sidePanelCollapsed` 双向同步（带抑制标志避免循环写入）。

### ⚠️ 不兼容变更

1. **互斥分组取消**：旧「互斥（mutex）」模式移除，升级时被静默丢弃且无替代能力；原「绑定分组」更名为「绑定小组（Bundle）」。
2. **历史会话移除**：`kleros.session.history` 不再读写，导出 JSON 中 `sessions.history` 恒为 `[]`，导入时该字段被忽略——旧历史会话等同丢失。
3. **常驻名单结构变更**：扁平数组 → 分组数组。旧数据会自动归入「默认组」，但**分组名与分组颜色丢失**，需手动整理。
4. **偏好结构升级至 `prefsVersion = 3`**：`animationSpeed`（off/fast/normal/slow）被数值 `scrollSpeed` 取代，迁移映射为 off/normal→1、fast→1.6、slow→0.6，属近似值，建议复查。
5. **候选池口径变更**：当前名单与名册中的同名者合并为 1 个候选（此前为 2 个）。
6. **开发者向重命名/移除**（对二次开发有影响）：
   - `types/binding.ts` → `types/bundle.ts`（`BindingGroup` → `Bundle`）；
   - `useBindingGroups` → `useBundles`，数据存储位置改为 `Round.bundles`；
   - `BindingGroupsDialog.vue` → `BundlesDialog.vue`；
   - 移除 `useSessionManager.ts`、`HistorySection.vue`、`SidePanelSection.vue`；
   - 常量 `BINDING_GROUP_COLORS` 与 `UID_PREFIX.BINDING = 'b_'` 为兼容保留旧名（命名不一致属已知遗留）。

### 📌 升级注意事项

- **升级前请先导出 JSON 备份**（设置 → 导出），历史会话不会被迁移，若有留存需求请在旧版本中先导出归档。
- 数据仍会**一次性从 localStorage / sessionStorage 迁入 IndexedDB**（`kleros_v4` v3），迁移完成后旧 key 被删除；迁移仅覆盖 5 个固定 store（不含 history）。
- **禁用 IndexedDB 的环境（如浏览器隐私模式）无降级方案**，数据将无法持久化。
- 备份文件**仅在本地名单为空时兜底恢复**，本地已有数据时不会用备份覆盖。
- 曾使用互斥分组的用户，升级后需改用「绑定小组」（≥2 人）或通过黑白名单手工排除。
- 升级后建议在设置中复查：主题、布局模式、抽取方式、滚动速率、抽取口径、结果分隔符，以及是否开启「记住视图模式」。
- 构建产物为单文件 HTML，可直接双击打开；分发前请确认输出文件名与版本号一致。

### 🐞 已知问题

- 构建产物文件名仍为 `Kleros 1.4.html`（`vite.config.ts` 中 `VERSION` 常量未同步为 1.5）。
- 导出的 JSON 中 `sessions.history` 恒为空数组，历史会话无法随备份迁移。
- 隐私模式 / 禁用 IndexedDB 时无 localStorage 降级，数据无法持久化。
- 备份恢复仅在本地名单为空时生效，本地有数据时不会覆盖。
- 名单中删除成员可能连带解散不足 2 人的绑定小组（无提示）。
- 窄屏（≤900px）侧栏只自动收起、不自动展开。
- 常量与 UID 前缀仍沿用 `BINDING_GROUP_COLORS` / `b_` 旧名，代码层命名不一致。
- `README.md` 的架构与存储说明仍停留在 1.0 版本，未同步本次变更。

### 📦 受影响模块

| 模块 | 主要文件 | 变更类型 |
|---|---|---|
| 布局 / 主题 | `App.vue`、`AppHeader.vue`、`AppFooter.vue`、`SidePanel.vue`、`assets/styles/*` | 重构 + 新增 |
| 抽取 | `PickerStage.vue`、`PickerControls.vue`、`PickerHistory.vue`、`usePicker.ts`、`utils/pick.ts` | 重构 + 新增 |
| 名单 / 名册 | `RosterPanel.vue`、`InputPanel.vue`、`NameChip.vue`、`LibraryDialog.vue`、`useRoster.ts`、`usePermanentRoster.ts` | 重构 + 新增 |
| 绑定小组 | `useBundles.ts`、`BundlesDialog.vue`、`types/bundle.ts` | 重命名 + 重构 |
| 黑白名单 | `BlackListSection.vue`、`WhiteListSection.vue`、`NamePicker.vue` | 优化 |
| 设置 / 偏好 | `SettingsDialog.vue`、`PickOptionsSection.vue`、`ToggleSwitch.vue`、`useSettings.ts`、`types/settings.ts` | 新增 + 迁移 |
| 会话 / 持久化 | `useSession.ts`、`types/session.ts`、`useDB.ts`、`constants.ts` | 重构（含不兼容） |
| 已移除 | `useSessionManager.ts`、`HistorySection.vue`、`SidePanelSection.vue`、`BindingGroupsDialog.vue`、`types/binding.ts` | 删除 |
