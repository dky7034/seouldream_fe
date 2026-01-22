// src/services/attendanceService.ts
import api from "./api";
import type {
  AttendanceDto,
  ProcessAttendanceRequest,
  OverallAttendanceSummaryDto,
  CellAttendanceSummaryDto,
  MemberAttendanceSummaryDto,
  AttendanceSummaryQueryParams,
  SimpleAttendanceRateDto,
  MemberAlertDto,
  GetAttendancesParams,
  Page,
  ProcessAttendanceWithPrayersRequest,
  CellReportDto,
  GetAttendanceAlertsParams,
} from "../types";

// Define query parameters for the new rate APIs, which don't use 'groupBy'
type AttendanceRateQueryParams = Omit<AttendanceSummaryQueryParams, "groupBy">;

export const attendanceService = {
  getAttendances: async (
    params?: GetAttendancesParams,
  ): Promise<Page<AttendanceDto>> => {
    try {
      const response = await api.get("/attendances", { params });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch attendances:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  processAttendances: async (
    data: ProcessAttendanceRequest[],
  ): Promise<AttendanceDto[]> => {
    try {
      const response = await api.post("/attendances/process", data);
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to process attendances:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  // ✅ 출석 + 기도제목 통합 저장 API
  processAttendanceWithPrayers: async (
    cellId: number,
    data: ProcessAttendanceWithPrayersRequest,
  ): Promise<void> => {
    try {
      await api.post(`/cells/${cellId}/attendance-with-prayers`, data);
    } catch (error: any) {
      console.error(
        `Failed to process attendances with prayers for cell ${cellId}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  // ✅ 특정 날짜의 셀 보고서(나눔, 특이사항) 조회 API
  getCellReport: async (
    cellId: number,
    date: string,
  ): Promise<CellReportDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendance-report`, {
        params: { date },
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell report for cell ${cellId}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  // ✅ [수정] 제출된 날짜 목록 조회 (이름을 getSubmittedDates로 통일)
  getSubmittedDates: async (
    cellId: number,
    year?: number,
    month?: number,
  ): Promise<string[]> => {
    try {
      const response = await api.get(`/cells/${cellId}/submitted-dates`, {
        params: { year, month },
      });
      return response.data; // ["2026-01-01", ...]
    } catch (error: any) {
      console.error(
        `Failed to fetch submitted dates for cell ${cellId}:`,
        error.response?.data || error.message,
      );
      return [];
    }
  },

  deleteAttendance: async (id: number): Promise<void> => {
    try {
      await api.delete(`/attendances/${id}`);
    } catch (error: any) {
      console.error(
        `Failed to delete attendance ${id}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getAttendanceAlerts: async (
    params: GetAttendanceAlertsParams,
  ): Promise<MemberAlertDto[]> => {
    try {
      const response = await api.get("/attendances/alerts", {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch attendance alerts:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getOverallAttendanceRate: async (
    params: AttendanceRateQueryParams,
  ): Promise<SimpleAttendanceRateDto> => {
    try {
      const response = await api.get("/attendances/rate/overall", { params });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch overall attendance rate:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getCellAttendanceRate: async (
    cellId: number,
    params: AttendanceRateQueryParams,
  ): Promise<SimpleAttendanceRateDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendance-rate`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${cellId} attendance rate:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getMemberAttendanceRate: async (
    cellId: number,
    params: any,
  ): Promise<SimpleAttendanceRateDto[]> => {
    try {
      const response = await api.get<SimpleAttendanceRateDto[]>(
        `/cells/${cellId}/members/attendance-rate`,
        { params },
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch member attendance rate for cell ${cellId}:`,
        error,
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
        "Failed to fetch available years for attendances:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getOverallAttendanceSummary: async (
    params: AttendanceSummaryQueryParams,
  ): Promise<OverallAttendanceSummaryDto> => {
    try {
      const response = await api.get("/attendances/summary/overall", {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch overall attendance summary:",
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getCellAttendanceSummary: async (
    cellId: number,
    params: AttendanceSummaryQueryParams,
  ): Promise<CellAttendanceSummaryDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendances/summary`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${cellId} attendance summary:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },

  getMemberAttendanceSummary: async (
    memberId: number,
    params: AttendanceSummaryQueryParams,
  ): Promise<MemberAttendanceSummaryDto> => {
    try {
      const response = await api.get(
        `/attendances/summary/members/${memberId}`,
        { params },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch member ${memberId} attendance summary:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  },
};
