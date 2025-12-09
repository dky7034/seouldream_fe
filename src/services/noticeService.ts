import api from './api';
import type { NoticeDto, CreateNoticeRequest, UpdateNoticeRequest, Page, GetAllNoticesParams } from '../types';

export const noticeService = {
  getAllNotices: async (params: GetAllNoticesParams): Promise<Page<NoticeDto>> => {
    try {
      const response = await api.get('/notices', { params });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch notices:', error.response?.data || error.message);
      throw error;
    }
  },

  getNoticeById: async (id: number): Promise<NoticeDto> => {
    try {
      const response = await api.get(`/notices/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch notice ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  createNotice: async (data: CreateNoticeRequest): Promise<NoticeDto> => {
    try {
      const response = await api.post('/notices', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create notice:', error.response?.data || error.message);
      throw error;
    }
  },

  updateNotice: async (id: number, data: UpdateNoticeRequest): Promise<NoticeDto> => {
    try {
      const response = await api.patch(`/notices/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update notice ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  deleteNotice: async (id: number): Promise<void> => {
    try {
      await api.delete(`/notices/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete notice ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  getAvailableYears: async (): Promise<number[]> => {
    try {
      const response = await api.get('/notices/available-years');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch available years for notices:', error.response?.data || error.message);
      throw error;
    }
  },
};
