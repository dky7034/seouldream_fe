// src/services/reportService.ts
import api from "./api";
import type { IncompleteCheckReportDto, GetAttendancesParams } from "../types";

export const reportService = {
  getIncompleteCheckReport: async (
    params: GetAttendancesParams
  ): Promise<IncompleteCheckReportDto[]> => {
    try {
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([_, v]) => v !== null && v !== undefined && v !== ""
        )
      );
      const response = await api.get("/reports/incomplete-checks", {
        params: cleanedParams,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch incomplete check report:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAvailableYearsForReports: async (): Promise<number[]> => {
    try {
      const response = await api.get("/reports/available-years");
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch available years for reports:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
