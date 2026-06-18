// types/index.ts
// 星羽炮分榜 - 全局类型定义

/** 队员性别 */
export type Gender = 1 | 2; // 1:男 2:女

/** 玩法类型 */
export type PlayMode =
  | 'cannon_rotation_8'   // 炮轮八人转
  | 'blind_cannon'         // 盲炮搭档赛
  | 'one_shot'             // 一炮定乾坤
  | 'bombardment'          // 炮轰循环赛
  | 'five_feather'         // 五羽炮轮比
  | 'free_cannon';         // 自由炮局

/** 玩法配置 */
export interface PlayModeConfig {
  mode: PlayMode;
  name: string;
  nameEn: string;
  desc: string;
  descShort?: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
}

/** 比赛状态 */
export type GameStatus = 'created' | 'ongoing' | 'finished';

/** 对阵状态 */
export type MatchStatus = 'pending' | 'playing' | 'finished';

/** 队员 */
export interface Member {
  _id: string;
  nickname: string;
  gender: Gender;
  avatarUrl: string;
  stats: {
    totalScore: number;
    totalGames: number;
    cannonKingCount: number;
    timesCannoned: number;
    maxSingleScore: number;
  };
  badges: BadgeType[];
  isCannonFodder: boolean;
  createdAt: string;
}

/** 炮击事件 */
export interface CannonEvent {
  from: string;   // memberId
  to: string;     // memberId
}

/** 单场对阵 */
export interface Match {
  round: number;
  court: number;
  teamA: string[];    // [playerId1, playerId2]
  teamB: string[];    // [playerId1, playerId2]
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | '';
  status: MatchStatus;
  cannonEvents: CannonEvent[];
}

/** 炮分记录 */
export interface CannonScoreRecord {
  memberId: string;
  baseScore: number;
  cannonWeight: number;
  winMultiplier: number;
  cannonPenalty: number;
  finalScore: number;
}

/** 比赛记录 */
export interface Game {
  _id: string;
  name: string;
  playMode: PlayMode;
  cannonWeight: number;     // 0.5 ~ 2.0
  status: GameStatus;
  players: string[];        // memberIds
  matches: Match[];
  cannonScores: Record<string, number>;  // memberId -> score
  billing?: BillingSheet;
  createdBy: string;        // openid
  createdAt: string;
  finishedAt?: string;
}

/** 费用分摊 */
export interface BillingSheet {
  courtFee: number;
  shuttleFee: number;
  otherFee: number;
  femaleDiscount: number;
  details: Record<string, number>;  // memberId -> amount
}

/** 徽章类型 */
export type BadgeType =
  | 'first_score'      // 首炮勋章
  | 'streak_win_3'     // 连炮勋章(连赢3局)
  | 'streak_lose_3'    // 哑炮勋章(连输3局)
  | 'cannon_god';      // 炮神勋章(周榜第一)

/** 排行榜维度 */
export type RankDimension = 'total' | 'weekly' | 'onepunch' | 'anti_cannon';

/** 排行条目 */
export interface RankItem {
  memberId: string;
  nickname: string;
  avatarUrl: string;
  gender?: number;       // 1=男 2=女
  score: number;
  rank: number;
  gamesPlayed: number;
  winRate: number;
}

/** 炮分计算结果 */
export interface ScoreResult {
  memberId: string;
  baseScore: number;
  cannonWeight: number;
  isWin: boolean;
  cannonedTimes: number;
  finalScore: number;
  breakdown: string;  // 如 "10 × 1.0 × 1.2 × 0.95 = 11"
}
