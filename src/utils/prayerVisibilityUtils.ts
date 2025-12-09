import type { PrayerVisibility } from "../types";

// 1) Visibility Map은 as const로 literal 타입 고정
export const PRAYER_VISIBILITY_MAP = {
  PRIVATE: "비공개",
  CELL: "셀 공개",
  ALL: "전체 공개",
} as const;

// 2) keyof typeof 로 key 타입을 정확히 가져오기
type VisibilityKey = keyof typeof PRAYER_VISIBILITY_MAP;

// 3) OPTIONS 배열 생성 (string[] → 정확한 union string[])
export const PRAYER_VISIBILITY_OPTIONS = (
  Object.keys(PRAYER_VISIBILITY_MAP) as VisibilityKey[]
).map((key) => ({
  value: key as PrayerVisibility,
  label: PRAYER_VISIBILITY_MAP[key],
}));

// 4) 번역 함수도 타입 안전하게 유지
export const translatePrayerVisibility = (
  visibility: PrayerVisibility
): string => {
  return PRAYER_VISIBILITY_MAP[visibility];
};
