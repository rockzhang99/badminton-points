// utils/api.ts
// 球局计分器 API 客户端 — 替代 wx.cloud 调用，统一走自部署后端
// 接口文档见 badmintonServer/README.md

const BASE_URL = 'https://badminton.caizhidao.cc';
const API_KEY = 'badminton-pao-ge-2024';

/** 通用请求封装 */
function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: any
): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      header: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      data: data ? JSON.stringify(data) : undefined,
      success(res) {
        // HTTP 2xx 且有 success 标记
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as any;
          if (body.success) {
            resolve(body.data as T);
          } else {
            reject(new Error(body.error || '请求失败'));
          }
        } else {
          const body = res.data as any;
          reject(new Error(body?.error || `HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

// ========== 比赛 API ==========

export interface GameRecord {
  _id?: string;
  name: string;
  playMode: string;
  cannonWeight: number;
  status: string;
  players: string[];
  playerDetails: any[];
  matches: any[];
  cannonScores: Record<string, number>;
  billing?: any;
  createdBy: string;
  createdAt: string;
  finishedAt?: string;
}

export const gameApi = {
  /** 创建比赛 */
  create(game: Omit<GameRecord, '_id'>) {
    return request<GameRecord>('POST', '/api/games', game);
  },

  /** 获取比赛列表（按时间倒序） */
  list(limit = 50) {
    return request<GameRecord[]>('GET', `/api/games?limit=${limit}`);
  },

  /** 获取单场比赛详情 */
  get(id: string) {
    return request<GameRecord>('GET', `/api/games/${id}`);
  },

  /** 更新比赛（如保存账单） */
  update(id: string, data: Partial<GameRecord>) {
    return request<GameRecord>('PUT', `/api/games/${id}`, data);
  },

  /** 删除比赛 */
  remove(id: string) {
    return request<void>('DELETE', `/api/games/${id}`);
  }
};

// ========== 队员 API ==========

export interface MemberRecord {
  _id?: string;
  nickname: string;
  gender: number;
  avatarUrl: string;
  stats: {
    totalScore: number;
    totalGames: number;
    cannonKingCount: number;
    timesCannoned: number;
    maxSingleScore: number;
  };
  badges: string[];
  isCannonFodder: boolean;
  createdAt: string;
}

export const memberApi = {
  /** 创建队员 */
  create(member: Omit<MemberRecord, '_id'>) {
    return request<MemberRecord>('POST', '/api/members', member);
  },

  /** 获取全部队员列表 */
  list() {
    return request<MemberRecord[]>('GET', '/api/members');
  },

  /** 获取单个队员详情 */
  get(id: string) {
    return request<MemberRecord>('GET', `/api/members/${id}`);
  },

  /** 更新队员信息/统计 */
  update(id: string, data: Partial<MemberRecord>) {
    return request<MemberRecord>('PUT', `/api/members/${id}`, data);
  },

  /** 删除队员 */
  remove(id: string) {
    return request<void>('DELETE', `/api/members/${id}`);
  }
};

// ========== 排行榜 API ==========

export interface LeaderboardEntry {
  memberId: string;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  maxSingleScore: number;
  rank: number;
  score: number;
  nickname: string;
  avatarUrl: string;
  winRate: number;
  avatarColor: string;
}

export const leaderboardApi = {
  /** 获取排行榜（dimension: total | onepunch, period: total | weekly） */
  get(dimension = 'total', period = 'total') {
    return request<LeaderboardEntry[]>('GET', `/api/leaderboard?dimension=${dimension}&period=${period}`);
  }
};

// ========== 周重置 API ==========

export const weeklyResetApi = {
  /** 记录周重置 */
  reset() {
    return request<any>('POST', '/api/weekly-reset');
  },

  /** 获取最近一次重置时间 */
  latest() {
    return request<any>('GET', '/api/weekly-reset/latest');
  }
};
