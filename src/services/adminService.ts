// src/services/adminService.ts
import api from './api';

const adminService = {
  /**
   * 관리자가 특정 사용자의 비밀번호를 임시 비밀번호로 재설정합니다.
   * @param memberId 비밀번호를 재설정할 멤버의 ID
   * @returns Promise<{ temporaryPassword: string }>
   */
  resetPassword: async (memberId: number): Promise<{ temporaryPassword: string }> => {
    try {
      const response = await api.post(`/admin/members/${memberId}/reset-password`);
      return response.data;
    } catch (error: any) {
      console.error(`Password reset error for member ${memberId}:`, error.response?.data || error.message);
      throw error;
    }
  },
};

export default adminService;
