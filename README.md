# 星雨炮分榜 (StarCannon Leaderboard)

> 一炮打出你的羽球排名 —— 羽毛球俱乐部积分排行小程序

---

## 一、产品概述

| | |
|---|---|
| **品牌** | 星雨炮分榜 |
| **IP 人设** | 章一炮（炮哥），硬核、直接、会整活 |
| **目标用户** | 羽毛球俱乐部、固定球局、临时约球群体 |
| **核心价值** | 创新分组玩法 + 轻松积分排行 + 费用一炮算清 |
| **Slogan** | 开炮页："一炮组局，炮分上榜" / 积分榜："谁是真炮王？" |

---

## 二、核心特色（vs 竞品）

| 维度 | 竞品（羽毛球工具） | 星雨炮分榜 |
|---|---|---|
| 分组玩法 | 传统八人转、固搭循环 | **炮式轮转、炮轰搭档、盲炮赛** |
| 积分体系 | 简单胜负积分 | **炮分（可爆破/可累积）、炮王周榜** |
| 费用分摊 | 固定女生减球费 | **炮费制（按炮分系数分摊）** |
| 交互氛围 | 工具型，偏严肃 | **游戏化、带炮声反馈、弹幕式"开炮"** |

---

## 三、功能模块

### 底部 Tab 导航
```
开炮组局  |  炮分榜  |  炮库  |  我的
```

### 3.1 开炮组局（核心玩法入口）

| 玩法名称 | 简介 | 人数 |
|---|---|---|
| **炮轮八人转** | 八人转，负方"挨炮"换位，胜方"连炮"守擂 | 8人 |
| **盲炮搭档赛** | 随机抽取搭档，打完才揭晓"谁是炮友" | 4-8人 |
| **一炮定乾坤** | 单败淘汰，每轮每人可发动一次"一炮加分"（直接+3分） | 4/8/16人 |
| **炮轰循环赛** | 固定搭档循环，每对有一枚"炮符"，使用后可强制重赛一局 | 3-6对 |
| **五羽炮轮比** | 每达10分倍数时，双方"互开一炮"（随机减对方1-2分） | 10人 |
| **自由炮局** | 自由组队，手动调整炮分系数 | 2-20人 |

**通用流程**：
```
建局（选玩法/添队员/设炮重） → 生成对阵（炮位图） → 记分（开炮面板） → 结果（炮分变化表/分享）
```

### 3.2 炮分榜（核心积分体系）

**炮分计算公式**：
```
单场炮分 = 基础分 × 炮重系数 × 胜负系数 × (1 - 炮击惩罚)
  基础分：胜+10，负+2
  炮重系数：局前设置（0.5~2.0）
  胜负系数：胜1.2，负0.8
  炮击惩罚：每被炮一次-5%，上限-30%
```

**四个维度**：
- **总炮分榜**：历史累计
- **周炮王榜**：每周一重置
- **一炮入魂榜**：单场最高炮分
- **抗炮榜**：被炮最多但胜率仍高

### 3.3 炮库（历史与队员）

- 历史比赛列表（按时间倒序），查看详情/一键重新开炮
- 队员管理（昵称/性别/头像/总炮分/炮王次数/抗炮次数/炮灰标记）
- 微信接龙、群聊昵称快速导入

### 3.4 球后算账（炮费分摊）

```
个人应付 = 场地费/N + 球费 × (个人炮分/总炮分) - 女生减免(默认5元)
```

支持"炮哥请客"按钮，生成账单并微信分享。

### 3.5 炮徽章系统

首炮勋章 → 连炮勋章 → 哑炮勋章 → 炮神勋章

---

## 四、技术方案

### 4.1 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| **前端框架** | 原生微信小程序 + TypeScript | 轻量、审核好过 |
| **后端/数据** | 微信云开发 | 免运维，云数据库+云函数开箱即用 |
| **云数据库** | 文档型数据库 | 比赛数据、队员、炮分记录 |
| **云函数** | Node.js | 排行榜聚合查询、周榜重置 |
| **云存储** | 微信云存储 | 头像、分享图 |

没有 FastAPI，没有 Docker，没有 PostgreSQL，没有 Redis。

### 4.2 开发流程

```
微信开发者工具（本地开发）
    ├── 云开发控制台（云函数本地调试）
    └── 上传 → 微信小程序后台 → 提交审核 → 发布
```

### 4.3 项目结构

```
miniprogram/
├── app.ts / app.json / app.wxss          ← 入口
├── types/index.ts                         ← 全局类型定义
├── utils/                                 ← 核心引擎
│   ├── match-engine.ts                    ← 6种对阵算法
│   ├── score-engine.ts                    ← 炮分计算引擎
│   ├── billing.ts                         ← 炮费分摊算法
│   └── play-modes.ts                      ← 玩法配置
├── pages/
│   ├── index/                             ← 首页（玩法卡片）
│   ├── cannon/
│   │   ├── create/                        ← 建局（选玩法/队员/炮重）
│   │   ├── match/                         ← 对阵生成（炮位图）
│   │   ├── scoring/                       ← 记分页（核心！左右滑场地/开炮面板）
│   │   └── result/                        ← 结果页（MVP/炮分表/分享）
│   ├── leaderboard/total/                 ← 炮分榜（4维Tab切换）
│   ├── arsenal/
│   │   ├── history/                       ← 历史比赛
│   │   ├── detail/                        ← 比赛详情
│   │   └── members/                       ← 队员管理
│   ├── settlement/billing/                ← 球后算账
│   └── mine/
│       ├── index/                         ← 个人中心
│       └── badges/                        ← 炮徽章
├── cloudfunctions/
│   ├── getLeaderboard/                    ← 排行榜聚合查询
│   └── weeklyReset/                       ← 周榜重置定时任务
├── types/
├── typings/
├── project.config.json
├── tsconfig.json
├── package.json
└── sitemap.json
```

### 4.4 数据设计

**云数据库集合**：

`games` - 比赛记录
```typescript
{
  _id, name, playMode, cannonWeight, status,          // 基础信息
  players: string[],                                    // 参赛队员
  matches: [{ round, court, teamA, teamB, scoreA,      // 对阵明细
              scoreB, winner, cannonEvents }],          // 炮击记录
  cannonScores: Record<string, number>,                 // 各人本场炮分
  billing: { courtFee, shuttleFee, femaleDiscount,      // 费用分摊
             details },
  createdBy, createdAt
}
```

`members` - 队员
```typescript
{
  _id, nickname, gender, avatarUrl,
  stats: { totalScore, totalGames, cannonKingCount,    // 统计数据
           timesCannoned, maxSingleScore },
  badges: string[],                                      // 徽章
  isCannonFodder: boolean                               // 炮灰标记
}
```

### 4.5 核心算法

**炮分计算** (`utils/score-engine.ts`)：
- 四因子公式：基础分 × 炮重系数 × 胜负系数 × 炮击惩罚
- 炮击惩罚逐次叠加，上限 30%

**对阵生成** (`utils/match-engine.ts`)：
- 炮轮八人转：固定1号位，其余顺时针轮转，7轮共14场
- 盲炮搭档：随机配对
- 单败淘汰：标准淘汰赛制
- 循环赛：固定搭档循环
- 五羽轮比：AB队各5人，累计得分
- 自由局：自由组队

**炮费分摊** (`utils/billing.ts`)：
- 场地费全员均摊
- 球费按炮分比例
- 女生默认减免 5 元（可配置）
- 炮哥请客（手动免除）

---

## 五、启动方式

```
1. 微信开发者工具 → 导入项目 → 选择 miniprogram 目录
2. 填入你的 AppID
3. 开通云开发（在开发者工具中点一下按钮）
4. 创建云数据库集合：games、members
5. 右键 cloudfunctions/ → 上传并部署
6. 在云开发控制台为 weeklyReset 配置定时触发器（每周一触发）
7. Tab 图标放到 miniprogram/images/ 目录
8. 音效文件放到 miniprogram/static/audio/ 目录
9. 编译 → 手机扫码预览
```

---

## 六、开发状态

| 模块 | 文件 | 状态 |
|---|---|---|
| 入口 | `app.ts/json/wxss` | ✅ |
| 类型定义 | `types/index.ts` | ✅ |
| 对阵引擎 | `utils/match-engine.ts` | ✅ |
| 炮分引擎 | `utils/score-engine.ts` | ✅ |
| 炮费分摊 | `utils/billing.ts` | ✅ |
| 玩法配置 | `utils/play-modes.ts` | ✅ |
| 首页 | `pages/index/` | ✅ |
| 建局 | `pages/cannon/create/` | ✅ |
| 对阵 | `pages/cannon/match/` | ✅ |
| 记分 | `pages/cannon/scoring/` | ✅ |
| 结果 | `pages/cannon/result/` | ✅ |
| 排行榜 | `pages/leaderboard/total/` | ✅ |
| 历史比赛 | `pages/arsenal/history/` | ✅ |
| 比赛详情 | `pages/arsenal/detail/` | ✅ |
| 队员管理 | `pages/arsenal/members/` | ✅ |
| 球后算账 | `pages/settlement/billing/` | ✅ |
| 个人中心 | `pages/mine/index/` | ✅ |
| 炮徽章 | `pages/mine/badges/` | ✅ |
| 云函数 | `cloudfunctions/*` | ✅ |

### 待完成
- [ ] Tab 图标（`images/`）
- [ ] 音效资源（`static/audio/`）
- [ ] 替换云环境 ID（`app.ts` → `starcannon-prod`）
- [ ] 微信开发者工具联调测试

---

## 七、交互与视觉

| | |
|---|---|
| **主色调** | 深蓝（星夜）+ 橙红（炮火） |
| **按钮风格** | 硬朗直角，带炮口火焰动画 |
| **加载动画** | 一颗炮弹飞过屏幕，炸出"星雨" |
| **音效** | 开炮声 / 击球声 / 炮鸣（可关闭） |

### 文案彩蛋
- 空状态：**"还没有炮局，快让章一炮开一炮！"**
- 分享卡片：**"我在这场炮局中轰下了XXX炮分！"**
- 错误提示：**"哑炮了，再试一次"**

---

## License

MIT
