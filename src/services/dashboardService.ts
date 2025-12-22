// src/services/dashboardService.ts
import api from "./api";
import type { DashboardDto } from "../types";

export const dashboardService = {
  // period는 기본값("3m") 유지하되, customRange가 있으면 덮어씌움
  getDashboardData: async (
    period: string = "3m",
    customRange?: { startDate: string; endDate: string }
  ): Promise<DashboardDto> => {
    try {
      const params: any = { period };

      // ✅ 날짜 범위가 있으면 API 파라미터에 추가 (백엔드 스펙 준수)
      if (customRange) {
        params.startDate = customRange.startDate;
        params.endDate = customRange.endDate;
      }

      const response = await api.get("/dashboard", { params });
      return response.data;
    } catch (error: any) {
      console.error(
        "Dashboard Load Failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
