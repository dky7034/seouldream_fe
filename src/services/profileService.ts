import api from './api';
import type { MemberDto, UpdateMyProfileRequest, ChangePasswordRequest, PasswordVerificationRequest } from '../types';

export const profileService = {
  getMyProfile: async (): Promise<MemberDto> => {
    try {
      const response = await api.get('/me/profile');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch my profile:', error.response?.data || error.message);
      throw error;
    }
  },

  updateMyProfile: async (data: UpdateMyProfileRequest): Promise<MemberDto> => {
    try {
      const response = await api.put('/me/profile', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update my profile:', error.response?.data || error.message);
      throw error;
    }
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    const { currentPassword, newPassword } = data;
    const requestData = {
      oldPassword: currentPassword,
      newPassword: newPassword
    };
    try {
      await api.put('/me/password', requestData);
    } catch (error: any) {
      console.error('Failed to change password:', error.response?.data || error.message);
      throw error;
    }
  },

  verifyPassword: async (password: string): Promise<void> => {
    try {
      const request: PasswordVerificationRequest = { password };
      const response = await api.post('/me/verify-password', request);
      if (!response.data.isValid) {
        throw new Error("현재 비밀번호가 올바르지 않습니다.");
      }
    } catch (error: any) {
      console.error('Password verification failed:', error.response?.data || error.message);
      throw error;
    }
  }
};

