import api from './api';
import type { SuggestionDto, CreateSuggestionRequest, UpdateSuggestionRequest } from '../types';

export const suggestionService = {
  getAllSuggestions: async (): Promise<SuggestionDto[]> => {
    try {
      const response = await api.get('/suggestions');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch suggestions:', error.response?.data || error.message);
      throw error;
    }
  },

  getSuggestionById: async (id: number): Promise<SuggestionDto> => {
    try {
      const response = await api.get(`/suggestions/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch suggestion ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  createSuggestion: async (data: CreateSuggestionRequest): Promise<SuggestionDto> => {
    try {
      const response = await api.post('/suggestions', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create suggestion:', error.response?.data || error.message);
      throw error;
    }
  },

  updateSuggestion: async (id: number, data: UpdateSuggestionRequest): Promise<SuggestionDto> => {
    try {
      const response = await api.patch(`/suggestions/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update suggestion ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  deleteSuggestion: async (id: number): Promise<void> => {
    try {
      await api.delete(`/suggestions/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete suggestion ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },
};