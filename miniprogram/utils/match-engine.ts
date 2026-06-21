// utils/match-engine.ts
// 对阵生成引擎 —— 2 种炮式玩法
import { Match, PlayMode } from '../types/index';

/**
 * 生成对阵 —— 根据玩法分发
 */
export function generateMatches(mode: PlayMode, players: string[]): Match[] {
  switch (mode) {
    case 'cannon_rotation_8':
      return generateCannonRotation(players);
    case 'blind_cannon':
      return generateBlindCannon(players);
    default:
      return [];
  }
}

/**
 * 四到八人转（4-8人）
 * 轮转搭档赛：每人与其他选手各搭档1次
 * 4人：3场，每人3场
 * 5人：5场，每人4场
 * 6人：6场，每人4场
 * 7人：14场，每人8场
 * 8人：14场，每人7场
 */
export function generateCannonRotation(players: string[]): Match[] {
  const n = players.length;
  if (n < 4 || n > 8) {
    throw new Error('四到八人转需要 4-8 名队员');
  }

  const pairKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const isDisjoint = (a: [number, number], b: [number, number]) =>
    a[0] !== b[0] && a[0] !== b[1] && a[1] !== b[0] && a[1] !== b[1];

  // 所有唯一搭档对
  const allPairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push([i, j]);
    }
  }

  // 所有合法对阵候选（两个不相交的搭档对）
  const candidates: { a: [number, number]; b: [number, number] }[] = [];
  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      if (isDisjoint(allPairs[i], allPairs[j])) {
        candidates.push({ a: allPairs[i], b: allPairs[j] });
      }
    }
  }

  // 各人数对应的场数
  const TARGET: Record<number, number> = { 4: 3, 5: 5, 6: 6, 7: 14, 8: 14 };
  const target = TARGET[n];

  const pairUsed: Record<string, number> = {};
  const playerMatches: number[] = new Array(n).fill(0);
  const selected: boolean[] = new Array(candidates.length).fill(false);
  const matches: { a: [number, number]; b: [number, number] }[] = [];

  while (matches.length < target) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      if (selected[i]) continue;
      const c = candidates[i];
      const ka = pairKey(c.a[0], c.a[1]);
      const kb = pairKey(c.b[0], c.b[1]);
      const pairScore = (pairUsed[ka] || 0) + (pairUsed[kb] || 0);
      const maxPlayer = Math.max(
        playerMatches[c.a[0]], playerMatches[c.a[1]],
        playerMatches[c.b[0]], playerMatches[c.b[1]]
      );
      const sumPlayer = playerMatches[c.a[0]] + playerMatches[c.a[1]] +
                        playerMatches[c.b[0]] + playerMatches[c.b[1]];
      // 优先使用未搭档过的组合，其次平衡每人场数
      const score = pairScore * 1000 + maxPlayer * 100 + sumPlayer;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    const c = candidates[bestIdx];
    selected[bestIdx] = true;
    matches.push({ a: c.a, b: c.b });
    pairUsed[pairKey(c.a[0], c.a[1])] = (pairUsed[pairKey(c.a[0], c.a[1])] || 0) + 1;
    pairUsed[pairKey(c.b[0], c.b[1])] = (pairUsed[pairKey(c.b[0], c.b[1])] || 0) + 1;
    playerMatches[c.a[0]]++;
    playerMatches[c.a[1]]++;
    playerMatches[c.b[0]]++;
    playerMatches[c.b[1]]++;
  }

  return matches.map((m, i) => ({
    round: i + 1,
    court: 1,
    teamA: [players[m.a[0]], players[m.a[1]]],
    teamB: [players[m.b[0]], players[m.b[1]]],
    scoreA: 0,
    scoreB: 0,
    winner: '',
    status: 'pending',
    cannonEvents: []
  }));
}

/**
 * 固定搭循环赛（6-12人 = 3-6对）
 * 搭档已固定（传入的 player IDs 中相邻两两一对），每对与其他各对交手1次
 * 不洗牌，保持传入顺序的配对结构
 */
export function generateBlindCannon(players: string[]): Match[] {
  const n = players.length;
  if (n < 6 || n > 12 || n % 2 !== 0) {
    throw new Error('固定搭循环赛需要 3-6 对（6-12人）');
  }

  // 相邻两两一对（不洗牌，保持传入顺序）
  const pairs: string[][] = [];
  for (let i = 0; i < players.length; i += 2) {
    pairs.push([players[i], players[i + 1]]);
  }

  // 每对与其他各对交手1次 → 单循环
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
 * 获取玩法的对阵预览信息
 */
export function getMatchPreview(mode: PlayMode, playerCount: number): {
  totalRounds: number;
  totalMatches: number;
  matchesPerPlayer: number;
} {
  switch (mode) {
    case 'cannon_rotation_8': {
      const PREVIEW: Record<number, { totalRounds: number; totalMatches: number; matchesPerPlayer: number }> = {
        4: { totalRounds: 3, totalMatches: 3, matchesPerPlayer: 3 },
        5: { totalRounds: 5, totalMatches: 5, matchesPerPlayer: 4 },
        6: { totalRounds: 6, totalMatches: 6, matchesPerPlayer: 4 },
        7: { totalRounds: 14, totalMatches: 14, matchesPerPlayer: 8 },
        8: { totalRounds: 7, totalMatches: 14, matchesPerPlayer: 7 }
      };
      return PREVIEW[playerCount] || { totalRounds: 0, totalMatches: 0, matchesPerPlayer: 0 };
    }
    case 'blind_cannon': {
      const pairs = playerCount / 2;
      return {
        totalRounds: pairs * (pairs - 1) / 2,
        totalMatches: pairs * (pairs - 1) / 2,
        matchesPerPlayer: pairs - 1
      };
    }
  }
}
