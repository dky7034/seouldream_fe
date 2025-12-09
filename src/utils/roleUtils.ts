// src/utils/roleUtils.ts
import type { NoticeTarget } from "../types";

// 역할 이름을 한글로 변환
export const translateRole = (role: string): string => {
  switch (role) {
    case "EXECUTIVE":
      return "임원단";
    case "CELL_LEADER":
      return "셀장";
    case "MEMBER":
      return "셀원";
    default:
      return role;
  }
};

// 공지 대상을 한글로 변환
export const NOTICE_TARGET_MAP: { [key in NoticeTarget]: string } = {
  ALL: "전체",
  CELL_LEADER: "셀장",
  EXECUTIVE: "임원단",
  CELL: "특정 셀",
};

export const translateNoticeTarget = (target: NoticeTarget): string => {
  return NOTICE_TARGET_MAP[target] || target;
};

// 유저가 특정 role 중 하나라도 갖고 있는지 체크
export function checkUserRole(
  user: { role?: string | null } | null | undefined,
  allowedRoles: string[]
): boolean {
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
}
