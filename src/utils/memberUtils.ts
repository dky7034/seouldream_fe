// src/utils/memberUtils.ts

/**
 * 단일 멤버 기준 이름 + 생년월일(YYMMDD) 포맷팅
 * 예) 1990-01-03 -> "홍길동 (900103)"
 */
export function formatNameWithBirthdate(member: {
  name: string;
  birthDate?: string;
}): string {
  const { name, birthDate } = member;
  if (!birthDate) return name;

  const d = new Date(birthDate);
  const yy = String(d.getFullYear()).slice(2); // '1990' -> '90'
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // 1 → "01"
  const dd = String(d.getDate()).padStart(2, "0"); // 3 → "03"

  return `${name} (${yy}${mm}${dd})`;
}

/**
 * 전체 목록을 기준으로, 동명이인일 때만 생년월일을 붙여주는 함수
 * - 같은 이름이 2명 이상이면 -> "홍길동 (900103)"
 * - 아니면 -> "홍길동"
 */
export const formatDisplayName = <
  T extends { name: string; birthDate?: string }
>(
  item: T,
  allItems: T[]
): string => {
  if (!item) return "";

  const sameNameCount = allItems.filter((m) => m.name === item.name).length;

  if (sameNameCount > 1) {
    // T는 name, birthDate를 가지고 있으므로 그대로 재사용 가능
    return formatNameWithBirthdate(item);
  }

  return item.name;
};
