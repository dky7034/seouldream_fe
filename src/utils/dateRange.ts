// src/utils/dateRange.ts
export const getDateRangeFromPreset = (
  preset: "thisWeek" | "thisMonth" | "all"
) => {
  const today = new Date();

  if (preset === "thisWeek") {
    const day = today.getDay(); // 0: 일요일
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  if (preset === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  return {};
};
