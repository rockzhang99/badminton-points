// utils/billing.ts
// 炮费分摊算法
import { BillingSheet, Member } from '../types/index';

/**
 * 炮费分摊公式：
 * 个人应付 = 场地固定分摊 + 球费按炮分比例 - 女生减免
 *
 * - 场地固定分摊 = 场地费 / 人数
 * - 个人炮分系数 = 个人炮分 / 总炮分
 * - 球费按炮分 = 球费总额 × 个人炮分系数
 * - 女生减免 = min(5元, 个人应付)（可配置）
 * - 最终应付 = max(0, 个人应付 - 女生减免)
 */

export interface BillingParams {
  courtFee: number;         // 场地费总额
  shuttleFee: number;       // 球费总额
  otherFee: number;         // 其他费用
  femaleDiscount: number;   // 女生减免额，默认 5
  cannonScores: Record<string, number>;  // memberId -> 炮分
  members: Member[];        // 队员信息
}

export interface BillingResult {
  details: Record<string, {
    courtShare: number;
    scoreShare: number;
    otherShare: number;
    totalBeforeDiscount: number;
    discount: number;
    finalAmount: number;
  }>;
  totalBill: number;
  totalCollected: number;
  exemptedMembers: string[];  // 被炮哥请客的队员
}

/**
 * 计算炮费分摊
 */
export function calcBilling(params: BillingParams): BillingResult {
  const { courtFee, shuttleFee, otherFee, femaleDiscount, cannonScores, members } = params;
  const playerCount = Object.keys(cannonScores).length;

  if (playerCount === 0) {
    return { details: {}, totalBill: 0, totalCollected: 0, exemptedMembers: [] };
  }

  const totalScore = Object.values(cannonScores).reduce((sum, s) => sum + s, 0) || 1; // 防除零
  const courtShare = courtFee / playerCount;
  const otherShare = otherFee / playerCount;

  const details: BillingResult['details'] = {};
  let totalCollected = 0;

  for (const [mid, score] of Object.entries(cannonScores)) {
    const member = members.find(m => m._id === mid);
    const scoreRatio = score / totalScore;
    const scoreShare = shuttleFee * scoreRatio;

    const totalBefore = courtShare + scoreShare + otherShare;
    const discount = member?.gender === 2 ? Math.min(femaleDiscount, totalBefore) : 0;
    const finalAmount = Math.round(Math.max(0, totalBefore - discount));

    details[mid] = {
      courtShare: Math.round(courtShare),
      scoreShare: Math.round(scoreShare),
      otherShare: Math.round(otherShare),
      totalBeforeDiscount: Math.round(totalBefore),
      discount: Math.round(discount),
      finalAmount
    };

    totalCollected += finalAmount;
  }

  const totalBill = courtFee + shuttleFee + otherFee;

  return {
    details,
    totalBill,
    totalCollected,
    exemptedMembers: []
  };
}

/**
 * 炮哥请客：免除指定队员的费用
 */
export function exemptMember(
  result: BillingResult,
  memberId: string
): BillingResult {
  if (result.details[memberId]) {
    result.exemptedMembers.push(memberId);
    result.totalCollected -= result.details[memberId].finalAmount;
    result.details[memberId] = {
      ...result.details[memberId],
      discount: result.details[memberId].totalBeforeDiscount,
      finalAmount: 0
    };
  }
  return result;
}

/**
 * 格式化分摊明细为展示文本
 */
export function formatBillingForShare(result: BillingResult, members: Member[]): string {
  const memberMap = new Map(members.map(m => [m._id, m.nickname]));
  const lines: string[] = [
    '═══ 炮费分摊明细 ═══',
    `场地费: ¥${result.totalBill}`,
    `实收: ¥${result.totalCollected}`,
    '───────────────'
  ];

  for (const [mid, detail] of Object.entries(result.details)) {
    const name = memberMap.get(mid) || mid;
    const exempt = result.exemptedMembers.includes(mid) ? ' (炮哥请客)' : '';
    lines.push(`${name}: ¥${detail.finalAmount}${exempt}`);
  }

  return lines.join('\n');
}
