import api from "./api";
import type {
  AggregatedTrendDto,
  GetAttendancesParams,
  AttendanceStatus,
  OverallAttendanceStatDto,
  AttendanceSummaryGroupBy,
} from "../types";

export const statisticsService = {
  getAttendanceTrend: async (params: {
    startDate?: string;
    endDate?: string;
    cellId?: number;
    memberId?: number;
    status?: AttendanceStatus;
    groupBy?: AttendanceSummaryGroupBy; // Add groupBy parameter
  }): Promise<AggregatedTrendDto[]> => {
    try {
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== undefined && v !== ""
        )
      );

      const response = await api.get("/statistics/attendance-trend", {
        params: cleanedParams,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch attendance trend:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getOverallAttendance: async (
    params: GetAttendancesParams
  ): Promise<OverallAttendanceStatDto> => {
    try {
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([_, v]) => v !== null && v !== undefined && v !== ""
        )
      );
      const response = await api.get("/statistics/overall-attendance", {
        params: cleanedParams,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch overall attendance stats:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAvailableYears: async (): Promise<number[]> => {
    try {
      const response = await api.get("/statistics/available-years");
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch available years:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
