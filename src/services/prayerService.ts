import api from './api';
import type { PrayerDto, CreatePrayerRequest, UpdatePrayerRequest, Page, GetPrayersParams } from '../types';

export const prayerService = {
  getPrayers: async (params: GetPrayersParams): Promise<Page<PrayerDto>> => {
    try {
      const response = await api.get('/prayers', { params });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch prayers:', error.response?.data || error.message);
      throw error;
    }
  },

  getPrayerById: async (id: number): Promise<PrayerDto> => {
    try {
      const response = await api.get(`/prayers/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch prayer ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  createPrayer: async (data: CreatePrayerRequest): Promise<PrayerDto> => {
    try {
      const response = await api.post('/prayers', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create prayer:', error.response?.data || error.message);
      throw error;
    }
  },

  updatePrayer: async (id: number, data: UpdatePrayerRequest): Promise<PrayerDto> => {
    try {
      const response = await api.patch(`/prayers/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update prayer ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  deletePrayer: async (id: number): Promise<void> => {
    try {
      await api.delete(`/prayers/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete prayer ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  getAvailableYears: async (): Promise<number[]> => {
    try {
      const response = await api.get('/prayers/available-years');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch available years for prayers:', error.response?.data || error.message);
      throw error;
    }
  },
};
