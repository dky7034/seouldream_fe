// src/services/statisticsService.ts
import qs from "qs";
import api from "./api";
import type {
  AggregatedTrendDto,
  GetAttendancesParams,
  AttendanceStatus,
  OverallAttendanceStatDto,
  AttendanceSummaryGroupBy,
  NewcomerStatDto,
  SemesterSummaryDto,
  UnassignedMemberDto,
} from "../types";

export const statisticsService = {
  // 1. [기존] 출석 추이 조회
  getAttendanceTrend: async (params: {
    startDate?: string;
    endDate?: string;
    cellId?: number;
    memberId?: number;
    status?: AttendanceStatus;
    groupBy?: AttendanceSummaryGroupBy;
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

  // 2. [기존] 전체 출석률 조회
  getOverallAttendance: async (
    params: GetAttendancesParams
  ): Promise<OverallAttendanceStatDto> => {
    try {
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== undefined && v !== ""
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

  // 3. [기존] 데이터 존재하는 연도 목록 조회
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

  // ----------------------------------------------------------------
  // ✅ [신규] 통계 대시보드 전용 API
  // ----------------------------------------------------------------

  /**
   * 4. 기간별 새가족 등록 추이
   */
  getNewcomerStats: async (
    groupBy: "MONTH" | "SEMESTER",
    startDate: string,
    endDate: string
  ): Promise<NewcomerStatDto[]> => {
    try {
      const response = await api.get("/statistics/newcomers", {
        params: { groupBy, startDate, endDate },
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch newcomer stats:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 5. 학기별 핵심 요약 & 인구 통계
   */
  getSemesterSummary: async (
    semesterId?: number
  ): Promise<SemesterSummaryDto> => {
    try {
      const params = semesterId ? { semesterId } : {};
      const response = await api.get("/statistics/semester-summary", {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch semester summary:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  /**
   * 6. 미배정 성도 상세 목록 조회
   * - 백엔드 가이드 반영 완료:
   * 1) 정렬 기준: registeredDate(X) -> createdAt(O)
   * 2) 제외 역할: PASTOR(X) 제거, EXECUTIVE만 유지
   */
  getUnassignedMembers: async (): Promise<UnassignedMemberDto[]> => {
    try {
      const response = await api.get("/members", {
        params: {
          unassigned: true,
          // ✅ 수정: 백엔드에 없는 'PASTOR' 제거하고 'EXECUTIVE'만 남김
          excludeRoles: ["EXECUTIVE"],
          size: 100,
          // ✅ 수정: 백엔드 가이드대로 'createdAt' 필드 사용
          sort: "createdAt,desc",
        },
        // ✅ 유지: 배열 파라미터 직렬화 (Spring Boot 호환용)
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      if (Array.isArray(response.data)) {
        return response.data;
      } else if (
        response.data &&
        Array.isArray((response.data as any).content)
      ) {
        return (response.data as any).content;
      }
      return [];
    } catch (error: any) {
      console.error(
        "Failed to fetch unassigned members:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
