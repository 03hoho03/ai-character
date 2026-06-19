import { BadRequestException } from '@nestjs/common';

/**
 * #32 소유 식별자 — 로그인이면 계정(userId), 비로그인이면 익명(browserId).
 * userId는 쿠키 JWT(가드)에서만 온다(#23 신뢰경계: body/query userId 불신뢰).
 */
export type OwnerContext = { userId: string } | { browserId: string };

/** 요청에서 owner 해석 — 쿠키 userId 우선, 없으면 browserId 폴백, 둘 다 없으면 400 */
export function resolveOwner(
  req: { user?: { userId?: string } },
  browserId?: string,
): OwnerContext {
  const userId = req.user?.userId;
  if (userId) return { userId };
  if (browserId) return { browserId };
  throw new BadRequestException('인증 또는 browserId가 필요합니다.');
}

/** owner → Prisma where/data 조각({userId} | {browserId}) */
export function ownerWhere(owner: OwnerContext): { userId: string } | { browserId: string } {
  return 'userId' in owner ? { userId: owner.userId } : { browserId: owner.browserId };
}

/** row 소유가 owner와 일치하는가 — 로그인이면 userId, 비로그인이면 browserId 비교 */
export function ownerMatches(
  row: { userId?: string | null; browserId?: string | null },
  owner: OwnerContext,
): boolean {
  return 'userId' in owner ? row.userId === owner.userId : row.browserId === owner.browserId;
}
