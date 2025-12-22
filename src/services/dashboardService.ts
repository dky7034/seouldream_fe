import api from './api';
import type { DashboardDto } from '../types';

export const dashboardService = {
  getDashboardData: async (period: string = '3m'): Promise<DashboardDto> => {
    try {
      const response = await api.get('/dashboard', { params: { period } });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error.response?.data || error.message);
      throw error;
    }
  },
};
