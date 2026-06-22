'use client';

/**
 * #35 인증 API 클라이언트 — #28 백엔드 /auth 엔드포인트에 대응.
 * 세션은 httpOnly JWT 쿠키이므로 모든 호출에 credentials:'include'가 필수다
 * (쿠키 수신/송신). 쓰기/조회 모두 실패는 throw 또는 null로 명시 전파한다.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** 프론트 정규화 사용자 — signup/login(SafeUser)·me({userId,email})의 형태 차이를 흡수 */
export type AuthUser = { id: string; email: string };

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

async function postCredentials(path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** SafeUser({id,email,createdAt}) → AuthUser */
function toAuthUser(raw: { id: string; email: string }): AuthUser {
  return { id: raw.id, email: raw.email };
}

/** 회원가입 — 성공 시 쿠키 발급 + 사용자 반환. 중복 이메일 등 실패는 AuthError */
export async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await postCredentials('/auth/signup', { email, password });
  if (!res.ok) throw new AuthError(res.status, `signup failed: ${res.status}`);
  return toAuthUser((await res.json()) as { id: string; email: string });
}

/** 로그인 — 성공 시 쿠키 발급 + 사용자 반환. 자격 불일치(401) 등은 AuthError */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await postCredentials('/auth/login', { email, password });
  if (!res.ok) throw new AuthError(res.status, `login failed: ${res.status}`);
  return toAuthUser((await res.json()) as { id: string; email: string });
}

/** 로그아웃 — 쿠키 제거. 실패해도 클라 상태는 익명으로 떨어뜨릴 것이라 throw하지 않는다 */
export async function logout(): Promise<void> {
  try {
    await postCredentials('/auth/logout');
  } catch {
    /* best-effort: 네트워크 실패여도 클라는 익명 폴백 */
  }
}

/** 현재 세션 조회(쿠키 기반). 미인증(401)/네트워크 실패면 null — 익명 폴백 신호 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const raw = (await res.json()) as { userId: string; email: string };
    return { id: raw.userId, email: raw.email };
  } catch {
    return null;
  }
}

/** #33 클레임 결과 — 재소유된 Character/Conversation 건수 */
export type ClaimResult = { characters: number; conversations: number };

/**
 * #33 익명 데이터 클레임 — 로그인 직후 현재 browserId 소유물을 계정으로 재소유 요청.
 * best-effort: 실패(미인증/네트워크)는 null로 삼켜 로그인 흐름을 막지 않는다(쿠키는 credentials로 운반).
 */
export async function claimAnonymousData(browserId: string): Promise<ClaimResult | null> {
  try {
    const res = await postCredentials('/auth/claim', { browserId });
    if (!res.ok) return null;
    return (await res.json()) as ClaimResult;
  } catch {
    return null;
  }
}
