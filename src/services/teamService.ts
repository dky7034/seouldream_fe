import api from './api';
import type { TeamDto, CreateTeamRequest, UpdateTeamRequest, Page, MemberDto, GetAllTeamsParams } from '../types';

export const teamService = {
  getAllTeams: async (params: GetAllTeamsParams): Promise<Page<TeamDto>> => {
    try {
      const response = await api.get('/teams', { params });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch teams:', error.response?.data || error.message);
      throw error;
    }
  },

  getTeamById: async (id: number): Promise<TeamDto> => {
    try {
      const response = await api.get(`/teams/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch team ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  createTeam: async (data: CreateTeamRequest): Promise<TeamDto> => {
    try {
      const response = await api.post('/teams', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create team:', error.response?.data || error.message);
      throw error;
    }
  },

  updateTeam: async (id: number, data: UpdateTeamRequest): Promise<TeamDto> => {
    try {
      const response = await api.patch(`/teams/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update team ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  deleteTeam: async (id: number): Promise<void> => {
    try {
      await api.delete(`/teams/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete team ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },
  
  getTeamMembers: async (teamId: number): Promise<MemberDto[]> => {
    try {
      const response = await api.get(`/teams/${teamId}/members`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch members for team ${teamId}:`, error.response?.data || error.message);
      throw error;
    }
  },

  addMembersToTeam: async (teamId: number, memberIds: number[]): Promise<void> => {
    try {
      await api.post(`/teams/${teamId}/members`, memberIds);
    } catch (error: any) {
      console.error(`Failed to add members to team ${teamId}:`, error.response?.data || error.message);
      throw error;
    }
  },
};
