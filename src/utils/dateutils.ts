// src/utils/dateUtils.ts
// YYYY-MM-DD 포맷 변환
export const toISODateString = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  const localISOTime = new Date(date.getTime() - offset).toISOString();
  return localISOTime.split("T")[0];
};

// 한국식 날짜 포맷 (YYYY년 M월 D일)
export const formatDateKorean = (
  dateStr: string | undefined | null
): string => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

// 이번 주 범위 (일요일 ~ 토요일 기준)
export const getThisWeekRange = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const day = today.getDay(); // 0: 일, 1: 월 ...

  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return {
    startDate: toISODateString(sunday),
    endDate: toISODateString(saturday),
  };
};

// 기간 계산 (1m, 3m 등)
export const getPeriodDates = (
  period: string
): { startDate: string; endDate: string } => {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "1m":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "3m":
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case "6m":
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case "12m":
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 3);
  }
  return {
    startDate: toISODateString(startDate),
    endDate: toISODateString(endDate),
  };
};
