# 互斥组（Binding Group）设计

日期：2026-06-26
状态：已批准，进入实现

## 1. 背景与目标

当前 Kleros 应用支持：
- 临时名单（可多分组）+ 常驻名单
- 「我全都要」开关（`crossGroup`）合并所有分组
- 单抽 / 多抽 N 人

实际使用中存在一类需求：把几个名字**绑定**在一起，抽中一个后其他人本会话不再参与抽取。例如「同一家只能中一个」、「同一项目组只能中一个」。

本次新增「互斥组」概念，独立于现有的「临时名单分组」（`RosterGroup`），承担"抽取互斥"职责。

## 2. 核心语义

- **互斥组（BindingGroup）**：一个**有名字、有颜色**的命名集合，包含 2+ 个 uid
- 同一 uid 可同时属于多个互斥组（**允许重叠**）
- 一旦本会话**抽中**组内任一 uid：
  - 同一组内**所有其他成员**本会话内不再参与抽取（"会话级全锁定"）
  - 直至**拆散**该组，锁定解除
- 单次多抽（pickMany）同一组**最多出 1 人**（per-draw 互斥）
- 抽取结束后"回溯"（`undoToPick`）→ picks 减少 → 锁定集合随派生的 picks 自动重算
- 拆散组 → 改 `bindingGroups` → 派生锁定自动失效

## 3. 数据模型

### 3.1 新增类型（`src/types/binding.ts`）

```ts
export interface BindingGroup {
  id: string
  name: string
  color: string         // 预设调色板之一（hex）
  memberUids: string[]  // 2+ 个；允许重叠
  createdAt: number
}
```

### 3.2 扩展 `Session`（`src/types/session.ts`）

```ts
export interface Session {
  // ...existing
  bindingGroups: BindingGroup[]   // 缺省视为 []
}
```

### 3.3 调色板常量（`src/constants.ts`）

```ts
export const BINDING_GROUP_COLORS = [
  '#E76F51', // 橙红
  '#F4A261', // 橙黄
  '#E9C46A', // 黄
  '#2A9D8F', // 青绿
  '#264653', // 深青
  '#5A7BD8', // 蓝
  '#9B5DE5', // 紫
  '#FF6B9D', // 粉
] as const
```

## 4. 状态管理

新增 `src/composables/useBindingGroups.ts`，封装当前会话的 `bindingGroups`：

```ts
useBindingGroups(): {
  groups: ComputedRef<BindingGroup[]>
  lockedUids: ComputedRef<Set<string>>     // 派生的"已被锁定"的 uid
  getGroupsForUid(uid): BindingGroup[]      // 反查，UI 用
  create({ name, color, memberUids }): BindingGroup | null
  rename(id, name): void
  recolor(id, color): void
  addMembers(id, uids): void
  removeMembers(id, uids): void             // 空组自动溶解
  dissolve(id): void
}
```

约束：
- 成员 uid 必须存在于当前 session 的 `roster + permanent` 合并集；create 时校验，不存在则忽略
- 任何 mutation 都通过改写 `current.value.bindingGroups` 触发持久化（已用 `useDB` deep watch）
- `lockedUids` 派生：对每个 pick 的每个 uid，遍历其所在组，把组内其他成员 uid 加入集合

`useRoster` 的 `remove(uid)` / `deleteEntries(uids)` 需同步从所有互斥组移除该 uid；组空则自动 dissolve。Hook 通过调用 `useBindingGroups().removeMembers` 实现。

## 5. 抽取算法变更（`src/utils/pick.ts`）

### 5.1 新增纯函数

```ts
export function getLockedUids(
  picks: PickRecord[],
  groups: BindingGroup[]
): Set<string>
```

- 遍历 picks × uids → 找其所在组 → 收集组内其他成员 uid
- 复杂度 O(P × U × G)

### 5.2 修改 `buildCandidatePool`

在第 5 步（本会话已抽过滤）之后新增第 6 步：

```ts
const locked = getLockedUids(session.picks, session.bindingGroups ?? [])
pool = pool.filter(p => !locked.has(p.uid))
```

### 5.3 新增 `pickManyWithMutex`

```ts
export function pickManyWithMutex(
  pool: CandidateItem[],
  n: number,
  groups: BindingGroup[]
): CandidateItem[]
```

- 洗牌后贪心选取：跳过与已选 uid 同组的候选
- 仍最多返回 n 个；不足时返回少于 n

### 5.4 `usePicker.ts` 集成

- `trigger()` 把 `current.value.bindingGroups ?? []` 透传给 `buildCandidatePool` 和 `pickMany`/`pickManyWithMutex`
- 多抽走 `pickManyWithMutex`；单抽走原 `pickOne`（互斥由候选池过滤自动完成）
- 动画单抽（`commitAnimatePick`）走单抽路径，同样自动应用锁定

## 6. UI

### 6.1 入口

在 `RosterPanel.vue` 顶部，"我全都要"开关同一行加「互斥组」按钮。点击 → `ui.openModal('bindingGroups')`。

### 6.2 模态框（新组件 `src/components/BindingGroupsDialog.vue`）

无 `×` 关闭按钮，无「取消」按钮。点遮罩 = 放弃编辑关闭。

布局：
```
┌─ 互斥组 ─────────────────────┐
│ [+ 新建组]                    │
│                                │
│ ┌─ 张三家 🟠 3人 [拆散]─┐   │
│ │  张三    ✕              │   │
│ │  张三妹  ✕              │   │
│ │  张三爸  ✕              │   │
│ └──────────────────────────┘   │
│                                │
│ ── 新建 / 编辑 ──             │
│  组名: [_________]              │
│  颜色: ⚪🟠🟡🟢🔵🟣🔴🟤   │
│  成员 (复选):                  │
│   ☑ 张三   (临时名单1)         │
│   ☐ 李四   (临时名单1)         │
│   ☐ 王五   (临时名单2)         │
│   ☐ 永久1  (常驻)              │
│                                │
│              [确定]            │
└────────────────────────────────┘
```

### 6.3 名单 chip 上的组徽章

每个 chip 右侧渲染 1+ 个小徽章：
- 8px 圆点，组颜色填充
- 跟一个组名（`font-size: 11px`，比 chip 名小 1px；`color: var(--color-text-muted)`）
- 重叠组按 `createdAt` 升序排列
- 徽章点击 → 打开模态框并定位到该组

`NameChip.vue` 暂不修改；徽章在 `RosterPanel.vue` 中与 chip 同级渲染。

## 7. 边界情况

| 场景 | 行为 |
|---|---|
| 抽中后「拆散」组 | 派生 `lockedUids` 自动消失；未抽成员可重新被抽 |
| 回溯 | picks 减少 → 锁定集合自动重算 |
| 删除临时名单条目 | 同步从所有互斥组移除该 uid；组空自动溶解 |
| 重叠：uid 在 A、B 组 | 抽中后 A、B 两组同时锁定 |
| 模态框选成员 | 列出临时+常驻，按"临时名单 X / 常驻"分组 |
| 颜色 | 8 色预设板（`BINDING_GROUP_COLORS`），不引入色彩选择器 |
| 空组 / 0/1 人 | 创建校验 ≥ 2 |
| 新会话 | `startNewSession` 写入 `bindingGroups: []` |
| 旧会话反序列化 | 缺字段时按 `[]` 兜底（`useSessionManager` init 路径） |

## 8. 改动文件清单

新增：
- `src/types/binding.ts`
- `src/composables/useBindingGroups.ts`
- `src/components/BindingGroupsDialog.vue`
- `docs/superpowers/specs/2026-06-26-binding-groups-design.md`

修改：
- `src/types/session.ts`（+1 字段）
- `src/constants.ts`（+调色板）
- `src/composables/useRoster.ts`（remove/deleteEntries 钩子）
- `src/composables/usePicker.ts`（透传 bindingGroups）
- `src/composables/useSession.ts`（`startNewSession` 写默认）
- `src/composables/useSessionManager.ts`（旧会话补默认）
- `src/composables/useUi.ts`（+ modal kind）
- `src/utils/pick.ts`（`getLockedUids` + `pickManyWithMutex`，修改 `buildCandidatePool`）
- `src/components/RosterPanel.vue`（徽章 + 入口按钮）
- `src/App.vue`（注册新 dialog）
- `src/assets/styles/components.css`（徽章样式）

## 9. 测试

项目无测试框架，纯函数 `getLockedUids` 与 `pickManyWithMutex` 设计为可单测，留在 `utils/pick.ts` 顶层 export 供未来引入测试时使用。

UI 验证（手动）：
1. 新建组 → 选中 2 人 → 确认 → 名单 chip 右侧出现徽章
2. 多抽 N → 验证同组只出 1 人
3. 抽中后再抽 → 该组其他人不可被抽（候选池过滤）
4. 拆散组 → 锁解除 → 再次多抽可抽到该组其他人
5. 跨组：同一人在 A、B 组，抽中后 A、B 同时锁定
6. 删除临时名单 → 同步从互斥组移除该 uid；空组自动消失
7. 回溯 → 锁定集合自动重算
8. 新会话 → bindingGroups 为空
