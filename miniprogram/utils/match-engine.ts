// utils/match-engine.ts
// 对阵生成引擎 —— 6 种炮式玩法
import { Match, PlayMode } from '../types/index';

/**
 * Fisher-Yates 洗牌
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 生成对阵 —— 根据玩法分发
 */
export function generateMatches(mode: PlayMode, players: string[]): Match[] {
  switch (mode) {
    case 'cannon_rotation_8':
      return generateCannonRotation8(players);
    case 'blind_cannon':
      return generateBlindCannon(players);
    case 'one_shot':
      return generateOneShot(players);
    case 'bombardment':
      return generateBombardment(players);
    case 'five_feather':
      return generateFiveFeather(players);
    case 'free_cannon':
      return generateFreeCannon(players);
    default:
      return [];
  }
}

/**
 * 炮轮八人转（8人）
 * 圆桌算法：固定1号位，其余顺时针轮转，共7轮14场
 */
export function generateCannonRotation8(players: string[]): Match[] {
  if (players.length !== 8) {
    throw new Error('炮轮八人转需要恰好 8 名队员');
  }

  const fixed = players[0];
  const rotating = [...players.slice(1)];
  const matches: Match[] = [];

  for (let round = 0; round < 7; round++) {
    const order = [fixed, ...rotating];
    // 配对: (1,8)(2,7)(3,6)(4,5) - 2场，每场4人
    const pairs: [string[], string[]][] = [
      [[order[0], order[7]], [order[1], order[6]]],
      [[order[2], order[5]], [order[3], order[4]]]
    ];

    pairs.forEach(([teamA, teamB], courtIndex) => {
      matches.push({
        round: round + 1,
        court: courtIndex + 1,
        teamA: [...teamA],
        teamB: [...teamB],
        scoreA: 0,
        scoreB: 0,
        winner: '',
        status: 'pending',
        cannonEvents: []
      });
    });

    // 顺时针旋转
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

/**
 * 盲炮搭档赛（4-8人）
 * 随机抽搭档，全程不显示队友名
 */
export function generateBlindCannon(players: string[]): Match[] {
  const n = players.length;
  if (n < 4 || n > 8 || n % 2 !== 0) {
    throw new Error('盲炮搭档赛需要 4/6/8 名队员');
  }

  const shuffled = shuffle(players);
  const pairs: string[][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }

  // 每对与其他各对交手
  const matches: Match[] = [];
  let round = 1;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      matches.push({
        round: round,
        court: 1,
        teamA: [...pairs[i]],
        teamB: [...pairs[j]],
        scoreA: 0,
        scoreB: 0,
        winner: '',
        status: 'pending',
        cannonEvents: []
      });
      round++;
    }
  }

  return matches;
}

/**
 * 一炮定乾坤（4/8/16人）
 * 标准单败淘汰赛
 */
export function generateOneShot(players: string[]): Match[] {
  if (![4, 8, 16].includes(players.length)) {
    throw new Error('一炮定乾坤支持 4/8/16 人');
  }

  const shuffled = shuffle(players);
  const matches: Match[] = [];
  let round = 1;
  let currentRoundPlayers = [...shuffled];

  while (currentRoundPlayers.length > 1) {
    for (let i = 0; i < currentRoundPlayers.length; i += 2) {
      matches.push({
        round,
        court: i / 2 + 1,
        teamA: [currentRoundPlayers[i]],
        teamB: [currentRoundPlayers[i + 1]],
        scoreA: 0,
        scoreB: 0,
        winner: '',
        status: 'pending',
        cannonEvents: []
      });
    }
    round++;
    // 下一轮人数减半（实际由比分决定晋级，此处仅占位）
  }

  return matches;
}

/**
 * 炮轰循环赛（3-6对）
 * 固定搭档循环
 */
export function generateBombardment(players: string[]): Match[] {
  if (players.length % 2 !== 0 || players.length < 6 || players.length > 12) {
    throw new Error('炮轰循环赛需要 3-6 对（6-12人）');
  }

  // 固定配对的搭档（相邻两人一组）
  const pairs: string[][] = [];
  for (let i = 0; i < players.length; i += 2) {
    pairs.push([players[i], players[i + 1]]);
  }

  // 循环对阵
  const matches: Match[] = [];
  let round = 1;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      matches.push({
        round: round,
        court: 1,
        teamA: [...pairs[i]],
        teamB: [...pairs[j]],
        scoreA: 0,
        scoreB: 0,
        winner: '',
        status: 'pending',
        cannonEvents: []
      });
      round++;
    }
  }

  return matches;
}

/**
 * 五羽炮轮比（10人，AB队各5人）
 * 接力积分制
 */
export function generateFiveFeather(players: string[]): Match[] {
  if (players.length !== 10) {
    throw new Error('五羽炮轮比需要恰好 10 名队员');
  }

  const shuffled = shuffle(players);
  // 分两队
  const teamA = shuffled.slice(0, 5);
  const teamB = shuffled.slice(5);

  // 5 轮接力，每轮各队派 2 人
  const matches: Match[] = [];
  for (let round = 1; round <= 5; round++) {
    const aIdx = (round - 1) % 5;
    const bIdx = (round - 1) % 5;
    const aPair = [teamA[aIdx], teamA[(aIdx + 1) % 5]];
    const bPair = [teamB[bIdx], teamB[(bIdx + 1) % 5]];

    matches.push({
      round,
      court: 1,
      teamA: aPair,
      teamB: bPair,
      scoreA: 0,
      scoreB: 0,
      winner: '',
      status: 'pending',
      cannonEvents: []
    });
  }

  return matches;
}

/**
 * 自由炮局（2-20人）
 * 返回空对阵，由用户手动拖拽生成
 */
export function generateFreeCannon(_players: string[]): Match[] {
  return [];
}

/**
 * 获取玩法的对阵预览信息
 */
export function getMatchPreview(mode: PlayMode, playerCount: number): {
  totalRounds: number;
  totalMatches: number;
  matchesPerPlayer: number;
} {
  switch (mode) {
    case 'cannon_rotation_8':
      return { totalRounds: 7, totalMatches: 14, matchesPerPlayer: 7 };
    case 'blind_cannon':
      return {
        totalRounds: ((playerCount / 2) * (playerCount / 2 - 1)) / 2,
        totalMatches: ((playerCount / 2) * (playerCount / 2 - 1)) / 2,
        matchesPerPlayer: playerCount / 2 - 1
      };
    case 'one_shot':
      return {
        totalRounds: Math.log2(playerCount),
        totalMatches: playerCount - 1,
        matchesPerPlayer: 1 // 输即淘汰
      };
    case 'bombardment':
      return {
        totalRounds: (playerCount / 2) * (playerCount / 2 - 1) / 2,
        totalMatches: (playerCount / 2) * (playerCount / 2 - 1) / 2,
        matchesPerPlayer: playerCount / 2 - 1
      };
    case 'five_feather':
      return { totalRounds: 5, totalMatches: 5, matchesPerPlayer: 2 };
    case 'free_cannon':
      return { totalRounds: 0, totalMatches: 0, matchesPerPlayer: 0 };
  }
}
