// utils/billing.ts
// 炮费分摊算法
import { Member } from '../types/index';

/**
 * 费用均摊公式：
 *
 * 【立减模式】个人应付 = (场地费 + 球费 + 其他费) / 人数 - 女生立减
 * 【固定球费模式】个人应付 = 场地费/人数 + 球费份额 + 其他费/人数
 *   - 女生球费份额 = 固定球费金额
 *   - 男生球费份额 = (总球费 - 女生固定总额) / 男生人数
 *   - 场地费和其他费始终全员均摊
 *
 * 所有费用人均分摊，不按炮分加权。
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
  /** 固定球费模式下的校验警告 */
  warning?: string;
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

  // ===== 固定球费模式：场地费始终全员均摊，只对球费部分做固定/差额分摊 =====
  if (femaleMode === 'fixed' && femaleFixedShuttle > 0) {
    return calcFixedBilling(params, playerCount);
  }

  // ===== 立减模式：所有费用均摊后减去立减金额 =====
  const equalShare = (courtFee + shuttleFee + otherFee) / playerCount;

  const details: BillingResult['details'] = {};
  let totalCollected = 0;

  for (const [mid] of Object.entries(cannonScores)) {
    const member = members.find(m => m._id === mid);
    const isFemale = member?.gender === 2;

    let discount: number = 0;
    if (isFemale) {
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

  return {
    details,
    totalBill,
    totalCollected,
    exemptedMembers: []
  };
}

/**
 * 固定球费模式计算：
 * - 场地费：全员均摊（女生也要付）
 * - 球费：女生付固定金额，男生分担剩余球费
 * - 其他费：全员均摊
 *
 * 校验规则：如果人均球费 <= 固定球费金额，返回 warning 阻止分摊
 */
function calcFixedBilling(params: BillingParams, playerCount: number): BillingResult {
  const { courtFee, shuttleFee, otherFee, femaleFixedShuttle, cannonScores, members } = params;

  const courtPerPerson = courtFee / playerCount;
  const otherPerPerson = otherFee / playerCount;
  const avgShuttlePerPerson = shuttleFee / playerCount;

  // 校验：人均球费不能小于等于固定球费，否则男生需要倒贴
  if (avgShuttlePerPerson <= femaleFixedShuttle && shuttleFee > 0) {
    return {
      details: {},
      totalBill: courtFee + shuttleFee + otherFee,
      totalCollected: 0,
      exemptedMembers: [],
      warning: `人均球费 ¥${avgShuttlePerPerson.toFixed(2)} 小于等于固定球费 ¥${femaleFixedShuttle}，请检查费用或调整固定金额`
    };
  }

  // 统计男女人数
  let femaleCount = 0;
  let maleCount = 0;
  const genderMap: Record<string, boolean> = {};

  for (const [mid] of Object.entries(cannonScores)) {
    const member = members.find(m => m._id === mid);
    const isFemale = member?.gender === 2;
    genderMap[mid] = !!isFemale;
    if (isFemale) femaleCount++;
    else maleCount++;
  }

  // 女生固定球费总额
  const femaleTotalFixed = femaleFixedShuttle * femaleCount;
  // 剩余球费由男生分担
  const remainingShuttle = Math.max(0, shuttleFee - femaleTotalFixed);
  const maleShuttleShare = maleCount > 0 ? remainingShuttle / maleCount : 0;

  const details: BillingResult['details'] = {};
  let totalCollected = 0;

  for (const [mid] of Object.entries(cannonScores)) {
    const isFemale = genderMap[mid];
    const scoreShare = isFemale ? femaleFixedShuttle : maleShuttleShare;

    const totalBefore = +(courtPerPerson + scoreShare + otherPerPerson).toFixed(2);
    const discount = isFemale ? +(totalBefore - (courtPerPerson + femaleFixedShuttle + otherPerPerson)).toFixed(2) : 0;
    const finalAmount = isFemale
      ? +(courtPerPerson + femaleFixedShuttle + otherPerPerson).toFixed(2)
      : +(courtPerPerson + maleShuttleShare + otherPerPerson).toFixed(2);

    details[mid] = {
      courtShare: +courtPerPerson.toFixed(2),
      scoreShare: +scoreShare.toFixed(2),
      otherShare: +otherPerPerson.toFixed(2),
      totalBeforeDiscount: totalBefore,
      discount: +discount.toFixed(2),
      finalAmount: +Math.max(0, finalAmount).toFixed(2),
      isFemale
    };

    totalCollected += finalAmount;
  }

  return {
    details,
    totalBill: courtFee + shuttleFee + otherFee,
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
