import api from './api';
import type { 
  CellDto, 
  CreateCellRequest, 
  UpdateCellRequest,
  CellAttendanceSummaryDto,
  AttendanceSummaryQueryParams,
  Page,
  GetAllCellsParams,
  SimpleAttendanceRateDto,
  CellLeaderDashboardDto, // Added CellLeaderDashboardDto
} from '../types';

export const cellService = {
  getAllCells: async (params: GetAllCellsParams): Promise<Page<CellDto>> => {
    try {
      const response = await api.get('/cells', { params });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch cells:', error.response?.data || error.message);
      throw error;
    }
  },

  getCellById: async (id: number): Promise<CellDto> => {
    try {
      const response = await api.get(`/cells/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch cell ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  createCell: async (data: CreateCellRequest): Promise<CellDto> => {
    try {
      const response = await api.post('/cells', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create cell:', error.response?.data || error.message);
      throw error;
    }
  },

  updateCell: async (id: number, data: UpdateCellRequest): Promise<CellDto> => {
    try {
      const response = await api.patch(`/cells/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update cell ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  deleteCell: async (id: number): Promise<void> => {
    try {
      await api.delete(`/cells/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete cell ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  getCellAttendanceSummary: async (cellId: number, params: AttendanceSummaryQueryParams): Promise<CellAttendanceSummaryDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendances/summary`, { params });
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch cell ${cellId} attendance summary:`, error.response?.data || error.message);
      throw error;
    }
  },

  getCellAttendanceRate: async (cellId: number, params: { startDate: string; endDate: string }): Promise<SimpleAttendanceRateDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/attendance-rate`, { params });
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch cell ${cellId} attendance rate:`, error.response?.data || error.message);
      throw error;
    }
  },

  getAvailableYearsForCell: async (cellId: number): Promise<number[]> => {
    try {
      const response = await api.get(`/cells/${cellId}/available-years`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch available years for cell ${cellId}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // New API for Cell Leader Dashboard Summary
  getDashboardSummary: async (cellId: number, params: AttendanceSummaryQueryParams): Promise<CellLeaderDashboardDto> => {
    try {
      const response = await api.get(`/cells/${cellId}/dashboard-summary`, { params });
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch cell ${cellId} dashboard summary:`, error.response?.data || error.message);
      throw error;
    }
  },
};
