// utils/play-modes.ts
// 6 种玩法配置
import { PlayModeConfig } from '../types/index';

export const PLAY_MODES: PlayModeConfig[] = [
  {
    mode: 'cannon_rotation_8',
    name: '炮轮八人转',
    nameEn: 'Cannon Rotation 8',
    desc: '4-8人轮转，每人与其他选手各搭档1次',
    descShort: '轮转搭档赛',
    minPlayers: 4,
    maxPlayers: 8,
    icon: '🎯'
  },
  {
    mode: 'blind_cannon',
    name: '盲炮搭档赛',
    nameEn: 'Blind Cannon Partner',
    desc: '随机抽取搭档，全程不显示队友名字，打完才揭晓"谁是炮友"',
    descShort: '固定搭档对抗',
    minPlayers: 4,
    maxPlayers: 8,
    icon: '🎲'
  },
  {
    mode: 'one_shot',
    name: '一炮定乾坤',
    nameEn: 'One Shot Finals',
    desc: '单败淘汰，每轮每人可发动一次"一炮加分"直接+3分',
    descShort: '轮换档档案',
    minPlayers: 4,
    maxPlayers: 16,
    icon: '💥'
  },
  {
    mode: 'bombardment',
    name: '炮轰循环赛',
    nameEn: 'Bombardment Round',
    desc: '固定搭档循环，每对有一枚"炮符"可强制重赛一局',
    descShort: '日常活动比分',
    minPlayers: 6,
    maxPlayers: 12,
    icon: '🔥'
  },
  {
    mode: 'five_feather',
    name: '五羽炮轮比',
    nameEn: '5-Feather Cannon',
    desc: '五羽轮比，每达10分倍数双方"互开一炮"随机减对方1-2分',
    descShort: '单败/小组赛',
    minPlayers: 10,
    maxPlayers: 10,
    icon: '🏸'
  },
  {
    mode: 'free_cannon',
    name: '自由炮局',
    nameEn: 'Free Cannon',
    desc: '自由组队，记录比分，可手动调整炮分系数',
    descShort: '费用分摊',
    minPlayers: 2,
    maxPlayers: 20,
    icon: '🎪'
  }
];

/** 根据人数筛选可用玩法 */
export function getAvailableModes(playerCount: number): PlayModeConfig[] {
  return PLAY_MODES.filter(m => playerCount >= m.minPlayers && playerCount <= m.maxPlayers);
}
