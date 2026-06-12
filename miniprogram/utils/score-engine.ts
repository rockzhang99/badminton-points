// utils/score-engine.ts
// 炮分计算引擎
import { ScoreResult, CannonScoreRecord, Match, CannonEvent } from '../types/index';

/**
 * 核心公式：
 * 单场炮分 = 基础分 × 炮重系数 × 胜负系数 × (1 - 炮击惩罚)
 *
 * - 基础分：胜+10，负+2
 * - 炮重系数：0.5 ~ 2.0，默认 1.0
 * - 胜负系数：胜 1.2，负 0.8
 * - 炮击惩罚：每被炮击1次 -5%，上限 -30%
 */

/** 基础分配置 */
const BASE_SCORE = {
  WIN: 10,
  LOSE: 2
};

/** 胜负系数 */
const WIN_MULTIPLIER = { WIN: 1.2, LOSE: 0.8 };

/** 单次炮击惩罚率 */
const CANNON_PENALTY_RATE = 0.05;

/** 炮击惩罚上限 */
const MAX_CANNON_PENALTY = 0.30;

/**
 * 计算单个队员的单场炮分
 */
export function calcSingleScore(params: {
  isWin: boolean;
  cannonWeight: number;
  cannonedTimes: number;
}): ScoreResult {
  const { isWin, cannonWeight, cannonedTimes } = params;

  const baseScore = isWin ? BASE_SCORE.WIN : BASE_SCORE.LOSE;
  const winMultiplier = isWin ? WIN_MULTIPLIER.WIN : WIN_MULTIPLIER.LOSE;
  const cannonPenalty = Math.min(cannonedTimes * CANNON_PENALTY_RATE, MAX_CANNON_PENALTY);

  const raw = baseScore * cannonWeight * winMultiplier * (1 - cannonPenalty);
  const finalScore = Math.round(raw);

  const breakdown = `${baseScore} × ${cannonWeight} × ${winMultiplier} × (1 - ${(cannonPenalty * 100).toFixed(0)}%) = ${finalScore}`;

  return {
    memberId: '',
    baseScore,
    cannonWeight,
    isWin,
    cannonedTimes,
    finalScore,
    breakdown
  };
}

/**
 * 计算一场对阵中所有队员的炮分
 */
export function calcMatchScores(
  match: Match,
  cannonWeight: number
): CannonScoreRecord[] {
  const records: CannonScoreRecord[] = [];

  // 统计每个人被炮次数
  const cannonedCount: Record<string, number> = {};
  for (const ev of match.cannonEvents) {
    cannonedCount[ev.to] = (cannonedCount[ev.to] || 0) + 1;
  }

  const isAWin = match.winner === 'A';
  const isBWin = match.winner === 'B';

  // A 队队员
  for (const memberId of [...match.teamA]) {
    const isWin = isAWin;
    const cannoned = cannonedCount[memberId] || 0;
    const result = calcSingleScore({ isWin, cannonWeight, cannonedTimes: cannoned });
    records.push({
      memberId,
      baseScore: result.baseScore,
      cannonWeight,
      winMultiplier: result.isWin ? WIN_MULTIPLIER.WIN : WIN_MULTIPLIER.LOSE,
      cannonPenalty: cannoned * CANNON_PENALTY_RATE,
      finalScore: result.finalScore
    });
  }

  // B 队队员
  for (const memberId of [...match.teamB]) {
    const isWin = isBWin;
    const cannoned = cannonedCount[memberId] || 0;
    const result = calcSingleScore({ isWin, cannonWeight, cannonedTimes: cannoned });
    records.push({
      memberId,
      baseScore: result.baseScore,
      cannonWeight,
      winMultiplier: result.isWin ? WIN_MULTIPLIER.WIN : WIN_MULTIPLIER.LOSE,
      cannonPenalty: cannoned * CANNON_PENALTY_RATE,
      finalScore: result.finalScore
    });
  }

  return records;
}

/**
 * 汇总整场比赛所有队员的炮分
 */
export function calcGameTotalScores(
  matches: Match[],
  cannonWeight: number,
  playerIds: string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const pid of playerIds) {
    totals[pid] = 0;
  }

  for (const match of matches) {
    if (match.status !== 'finished') continue;
    const records = calcMatchScores(match, cannonWeight);
    for (const rec of records) {
      totals[rec.memberId] = (totals[rec.memberId] || 0) + rec.finalScore;
    }
  }

  return totals;
}

/**
 * 统计炮击记录
 * 返回：被炮最多的人、开炮最多的人
 */
export function getCannonStats(matches: Match[]): {
  mostCannoned: { memberId: string; count: number } | null;
  mostFired: { memberId: string; count: number } | null;
} {
  const cannoned: Record<string, number> = {};
  const fired: Record<string, number> = {};

  for (const match of matches) {
    for (const ev of match.cannonEvents) {
      cannoned[ev.to] = (cannoned[ev.to] || 0) + 1;
      fired[ev.from] = (fired[ev.from] || 0) + 1;
    }
  }

  const mostCannoned = Object.entries(cannoned).reduce<{ memberId: string; count: number } | null>(
    (max, [mid, count]) => (count > (max?.count || 0) ? { memberId: mid, count } : max),
    null
  );

  const mostFired = Object.entries(fired).reduce<{ memberId: string; count: number } | null>(
    (max, [mid, count]) => (count > (max?.count || 0) ? { memberId: mid, count } : max),
    null
  );

  return { mostCannoned, mostFired };
}

/**
 * 炮分变化详情（用于结果页展示）
 */
export function getScoreChanges(
  matches: Match[],
  cannonWeight: number,
  players: string[]
): ScoreResult[] {
  return players.map(pid => {
    let totalScore = 0;
    let totalCannoned = 0;
    let wins = 0;
    let losses = 0;

    for (const match of matches) {
      if (match.status !== 'finished') continue;
      const isInTeamA = match.teamA.includes(pid);
      const isInTeamB = match.teamB.includes(pid);
      if (!isInTeamA && !isInTeamB) continue;

      const isWin = (isInTeamA && match.winner === 'A') || (isInTeamB && match.winner === 'B');
      const cannoned = match.cannonEvents.filter(ev => ev.to === pid).length;

      if (isWin) wins++;
      else losses++;
      totalCannoned += cannoned;

      const result = calcSingleScore({ isWin, cannonWeight, cannonedTimes: cannoned });
      totalScore += result.finalScore;
    }

    return {
      memberId: pid,
      baseScore: 0, // 汇总用，无意义
      cannonWeight,
      isWin: wins > losses,
      cannonedTimes: totalCannoned,
      finalScore: totalScore,
      breakdown: `${wins}胜${losses}负`
    };
  });
}
