// src/services/cellService.ts
import api from "./api";
import type {
  CellDto,
  CreateCellRequest,
  UpdateCellRequest,
  CellAttendanceSummaryDto,
  AttendanceSummaryQueryParams,
  Page,
  GetAllCellsParams,
  SimpleAttendanceRateDto,
  CellLeaderDashboardDto,
  CellMemberAttendanceSummaryDto,
} from "../types";

export const cellService = {
  getAllCells: async (params: GetAllCellsParams): Promise<Page<CellDto>> => {
    try {
      const response = await api.get("/cells", { params });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch cells:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getCellById: async (id: number): Promise<CellDto> => {
    try {
      const response = await api.get(`/cells/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // ✅ [신규 추가] 백엔드 변경 사항 반영: 셀 편성 연도 조회
  getAvailableYears: async (): Promise<number[]> => {
    try {
      const response = await api.get("/cells/available-years");
      return response.data;
    } catch (error: any) {
      console.error("Failed to fetch available years:", error);
      throw error;
    }
  },

  createCell: async (data: CreateCellRequest): Promise<CellDto> => {
    try {
      const response = await api.post("/cells", data);
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to create cell:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updateCell: async (id: number, data: UpdateCellRequest): Promise<CellDto> => {
    try {
      const response = await api.patch(`/cells/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to update cell ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  deleteCell: async (id: number): Promise<void> => {
    try {
      await api.delete(`/cells/${id}`);
    } catch (error: any) {
      console.error(
        `Failed to delete cell ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀 상세 출석 통계 (기간 + groupBy 기반)
   * 기간 파라미터 없으면 백엔드에서 "현재 활성 학기" 기본 적용
   */
  getCellAttendanceSummary: async (
    cellId: number,
    params?: AttendanceSummaryQueryParams
  ): Promise<CellAttendanceSummaryDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendances/summary`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${cellId} attendance summary:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀 간단 출석률
   * startDate/endDate 또는 year/month/quarter/half 사용 가능
   * 아무것도 안 넘기면 현재 학기 기준
   */
  getCellAttendanceRate: async (
    cellId: number,
    params?: AttendanceSummaryQueryParams
  ): Promise<SimpleAttendanceRateDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendance-rate`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${cellId} attendance rate:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀 데이터가 존재하는 연도 목록 (내림차순)
   */
  getAvailableYearsForCell: async (cellId: number): Promise<number[]> => {
    try {
      const response = await api.get(`/cells/${cellId}/available-years`);
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch available years for cell ${cellId}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀장 대시보드 요약 (출석 인원, 총 인원, 출석률, 미완료 출석 체크 주수)
   * - params 없으면 현재 학기
   * - year/month/quarter/half 등으로 기간 변경 가능
   */
  getDashboardSummary: async (
    cellId: number,
    params?: AttendanceSummaryQueryParams
  ): Promise<CellLeaderDashboardDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/dashboard-summary`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch cell ${cellId} dashboard summary:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀 내 멤버별 출석률 목록
   * - 랭킹/리스트용
   * - 기간 필터는 셀 출석률과 동일 규칙
   */
  getMemberAttendanceRates: async (
    cellId: number,
    params?: AttendanceSummaryQueryParams
  ): Promise<SimpleAttendanceRateDto[]> => {
    try {
      const response = await api.get(
        `/cells/${cellId}/members/attendance-rate`,
        { params }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch member attendance rates for cell ${cellId}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 셀 내 멤버별 상세 출석 요약
   * - 최근 출석일, 연속 결석 횟수 포함
   * - 기간 필터 없이 "현재 시점 기준" 요약을 제공
   */
  getMemberAttendanceSummary: async (
    cellId: number
  ): Promise<CellMemberAttendanceSummaryDto[]> => {
    try {
      const response = await api.get(
        `/cells/${cellId}/members/attendance-summary`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch member attendance summary for cell ${cellId}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
