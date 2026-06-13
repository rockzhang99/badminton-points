// utils/billing.ts
// 炮费分摊算法
import { Member } from '../types/index';

/**
 * 费用均摊公式：
 * 个人应付 = (场地费 + 球费 + 其他费) / 人数 - 女生减免
 *
 * 所有费用人均分摊，不按炮分加权。
 * - 女生减免 = min(5元, 个人应付)（可配置）
 * - 最终应付 = max(0, 个人应付 - 女生减免)
 */

export interface BillingParams {
  courtFee: number;         // 场地费总额
  shuttleFee: number;       // 球费总额
  otherFee: number;         // 其他费用
  femaleDiscount: number;   // 女生减免额（立减模式）
  femaleFixedShuttle?: number;  // 女生固定球费金额
  femaleMode?: 'deduct' | 'fixed';  // 女生优惠模式：deduct=立减, fixed=固定球费
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
    isFemale?: boolean;
  }>;
  totalBill: number;
  totalCollected: number;
  exemptedMembers: string[];  // 被炮哥请客的队员
}

/**
 * 计算炮费分摊
 */
export function calcBilling(params: BillingParams): BillingResult {
  const { courtFee, shuttleFee, otherFee, femaleDiscount, femaleFixedShuttle = 0, femaleMode = 'deduct', cannonScores, members } = params;
  const playerCount = Object.keys(cannonScores).length;

  if (playerCount === 0) {
    return { details: {}, totalBill: 0, totalCollected: 0, exemptedMembers: [] };
  }

  // 人均分摊：所有费用均分
  const equalShare = (courtFee + shuttleFee + otherFee) / playerCount;

  const details: BillingResult['details'] = {};
  let totalCollected = 0;

  for (const [mid] of Object.entries(cannonScores)) {
    const member = members.find(m => m._id === mid);
    const isFemale = member?.gender === 2;

    let discount: number = 0; // 减免额

    if (isFemale && femaleMode === 'fixed' && femaleFixedShuttle > 0) {
      // 固定球费模式：女生只付固定金额
      discount = equalShare - femaleFixedShuttle;
    } else if (isFemale && femaleMode === 'deduct') {
      // 立减模式：从总应付中扣除固定金额
      discount = Math.min(femaleDiscount, equalShare);
    }

    const totalBefore = equalShare;
    const finalAmount = Math.max(0, totalBefore - discount);

    details[mid] = {
      courtShare: +(equalShare).toFixed(2),
      scoreShare: 0,
      otherShare: 0,
      totalBeforeDiscount: +(equalShare).toFixed(2),
      discount: +discount.toFixed(2),
      finalAmount: +finalAmount.toFixed(2),
      isFemale: !!isFemale
    };

    totalCollected += finalAmount;
  }

  const totalBill = courtFee + shuttleFee + otherFee;

  // 女生减免的金额直接不收，不再摊到最后一个人身上
  // totalCollected 可能小于 totalBill

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
