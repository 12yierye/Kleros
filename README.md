# Kleros · 点名器

基于 Vue 3 + Vite + TypeScript 的轻量点名器。临时名单 + 常驻名单 + 黑白名单 + 会话式抽取。

## 启动

```bash
npm install
npm run dev
```

打开 http://localhost:5173

## 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | 仅类型检查 |

## 架构

```
src/
├── main.ts                     入口
├── App.vue                     顶层布局
├── types/                      类型定义
│   ├── roster.ts               临时/常驻
│   ├── session.ts              会话/抽取记录
│   ├── list.ts                 黑白名单
│   └── settings.ts             用户偏好
├── composables/                业务逻辑
│   ├── useStorage.ts           响应式 storage 封装
│   ├── useRoster.ts            临时名单 (sessionStorage)
│   ├── usePermanentRoster.ts   常驻名单 (localStorage)
│   ├── useBlackWhiteList.ts    黑白名单 (localStorage)
│   ├── useSession.ts           会话管理
│   ├── usePicker.ts            抽取逻辑 + 动画接口
│   ├── useSettings.ts          用户偏好
│   └── useUi.ts                UI 状态 (provide/inject)
├── utils/
│   ├── nameParser.ts           文本/CSV 解析
│   ├── pick.ts                 候选池 + Fisher-Yates
│   └── id.ts                   UID 生成
├── components/                 视图组件
│   ├── AppHeader.vue / AppFooter.vue
│   ├── SidePanel.vue + 各 Section
│   ├── InputPanel.vue          粘贴/手动/文件 三 Tab
│   ├── RosterPanel.vue         临时+常驻名单展示
│   ├── NameChip.vue
│   ├── PickerControls.vue      单抽/多抽
│   ├── PickerStage.vue         结果展示（动画留接口）
│   └── *Dialog.vue             设置/重命名/确认
└── assets/styles/              样式
```

## 数据模型要点

- **数据库主键 = UID**：每个名字条目有稳定 UID，允许同名不同 UID 共存
- **黑白名单按 name 字符串**：改名后不会自动同步，需要手动维护
- **候选池** = (临时 ∪ 常驻) − 黑名单 ∩ (白名单 or 全集) − 本会话已抽
- **会话** = 一次"开新会话 → 多次抽取 → 结束"周期；当前会话 + 历史会话列表
- **本地存储**：
  - `kleros.roster.temporary` (sessionStorage)
  - `kleros.roster.permanent` (localStorage)
  - `kleros.lists.bw` (localStorage)
  - `kleros.session.current` + `kleros.session.history` (localStorage)
  - `kleros.prefs` (localStorage)

## 首版功能范围

✅ 可用：
- 粘贴 / 手动 / 文件 三种方式添加临时名单
- 常驻名单 CRUD
- 黑/白名单（侧栏直接操作）
- 单抽 / 多抽
- 会话记录（手动开新会话 + 抽 N 人后自动开）
- 上下文重命名（单条目）
- 设置里的全局重命名（含历史/黑白名单同步选项）
- 历史上限可调

⏳ 留待下版：
- 抽取滚动动画（接口已在 `usePicker.trigger` 预留）
- 暗色主题
- 数据导入/导出 JSON
- 合并重名条目

## 目录约定

- 不写注释（除非必要）
- 优先小、组合式组件，避免巨型 SFC
- composable 集中处理状态，组件只负责渲染与交互
