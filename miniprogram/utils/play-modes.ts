// utils/play-modes.ts
// 6 种玩法配置
import { PlayModeConfig } from '../types/index';

export const PLAY_MODES: PlayModeConfig[] = [
  {
    mode: 'cannon_rotation_8',
    name: '多人轮转计分',
    nameEn: 'Cannon Rotation 8',
    desc: '4-8人轮转，每人与其他选手各搭档1次',
    descShort: '轮转搭档赛',
    minPlayers: 4,
    maxPlayers: 8,
    icon: '🎯'
  },
  {
    mode: 'blind_cannon',
    name: '固定搭档计分',
    nameEn: 'Fixed Partner RR',
    desc: '固定搭档・循环对抗（3-6对，每对2人）',
    descShort: '固定搭档循环',
    minPlayers: 6,
    maxPlayers: 12,
    icon: '🎲'
  },
];

/** 根据人数筛选可用玩法 */
export function getAvailableModes(playerCount: number): PlayModeConfig[] {
  return PLAY_MODES.filter(m => playerCount >= m.minPlayers && playerCount <= m.maxPlayers);
}
