import api from './api';
import type { 
  MemberDto, 
  CreateMemberRequest,
  UpdateMemberRequest, 
  TeamDto,
  Page,
  GetAllMembersParams,
} from '../types';

export const memberService = {
  createMember: async (data: CreateMemberRequest): Promise<MemberDto> => {
    try {
      const response = await api.post('/members', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to create member:', error.response?.data || error.message);
      throw error;
    }
  },

  getAllMembers: async (params: GetAllMembersParams): Promise<Page<MemberDto>> => {
    try {
      const response = await api.get('/members', { params });
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch members:', error.response?.data || error.message);
      throw error;
    }
  },

  getMemberById: async (id: number): Promise<MemberDto> => {
    try {
      const response = await api.get(`/members/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch member ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  updateMember: async (id: number, data: UpdateMemberRequest): Promise<MemberDto> => {
    try {
      const response = await api.patch(`/members/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to update member ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  unassignMemberFromCell: async (memberId: number): Promise<void> => {
    try {
      await api.delete(`/members/${memberId}/cell`);
    } catch (error: any) {
      console.error(`Failed to unassign member ${memberId} from cell:`, error.response?.data || error.message);
      throw error;
    }
  },

  deleteMember: async (id: number): Promise<void> => {
    try {
      await api.delete(`/members/${id}`);
    } catch (error: any) {
      console.error(`Failed to delete member ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  getMemberTeams: async (memberId: number): Promise<TeamDto[]> => {
    try {
      const response = await api.get(`/members/${memberId}/teams`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to fetch teams for member ${memberId}:`, error.response?.data || error.message);
      throw error;
    }
  },

  addMemberToTeam: async (memberId: number, teamId: number): Promise<void> => {
    try {
      await api.post(`/members/${memberId}/teams/${teamId}`);
    } catch (error: any) {
      console.error(`Failed to add member ${memberId} to team ${teamId}:`, error.response?.data || error.message);
      throw error;
    }
  },

  removeMemberFromTeam: async (memberId: number, teamId: number): Promise<void> => {
    try {
      await api.delete(`/members/${memberId}/teams/${teamId}`);
    } catch (error: any) {
      console.error(`Failed to remove member ${memberId} from team ${teamId}:`, error.response?.data || error.message);
      throw error;
    }
  },

  getAvailableJoinYears: async (): Promise<number[]> => {
    try {
      const response = await api.get('/members/available-join-years');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch available join years:', error.response?.data || error.message);
      throw error;
    }
  },
};


