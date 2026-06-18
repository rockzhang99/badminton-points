# 星羽炮分榜 (StarCannon Leaderboard)

## 项目简介

羽毛球俱乐部积分排行微信小程序，采用原生微信小程序 + TypeScript + 微信云开发。

## 技术栈

- **前端**: 原生微信小程序 + TypeScript
- **后端**: 微信云开发（云数据库 + 云函数 + 云存储）
- **无**: FastAPI / Docker / PostgreSQL / Redis

## 项目结构

```
miniprogram/
├── app.ts / app.json / app.wxss     ← 入口
├── types/index.ts                    ← 全局类型定义
├── utils/
│   ├── match-engine.ts               ← 6种对阵算法
│   ├── score-engine.ts               ← 炮分计算引擎
│   ├── billing.ts                    ← 炮费分摊算法
│   └── play-modes.ts                 ← 玩法配置
├── pages/
│   ├── index/                        ← 首页
│   ├── cannon/ (create/match/scoring/result) ← 开炮组局核心流程
│   ├── leaderboard/total/            ← 炮分榜
│   ├── arsenal/ (history/detail/members) ← 炮库
│   ├── settlement/billing/           ← 球后算账
│   └── mine/ (index/badges)          ← 我的
├── cloudfunctions/                   ← 云函数
└── typings/                          ← WX API 类型声明
```

## 关键业务概念

- **炮分公式**: 基础分 × 炮重系数 × 胜负系数 × (1 - 炮击惩罚)
- **6种玩法**: 炮轮八人转、盲炮搭档赛、一炮定乾坤、炮轰循环赛、五羽炮轮比、自由炮局
- **炮费分摊**: 场地费均摊 + 球费按炮分比例 + 女生减免
- **品牌IP**: 章一炮（炮哥），交互风格硬核、游戏化、带炮声反馈

## 开发注意事项

- 使用微信开发者工具导入 `miniprogram/` 目录
- 云环境 ID 在 `app.ts` 中配置
- 云数据库集合: games、members
- 云函数需右键上传并部署
- weeklyReset 需配置定时触发器（每周一）
