import api from './api';

const downloadFile = (data: Blob, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url); // Clean up
};

export const exportService = {
  exportCellMembers: async (cellId: number) => {
    try {
      const response = await api.get(`/export/cells/${cellId}/members.xlsx`, {
        responseType: 'blob', // This is crucial for handling file downloads
      });
      
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || `cell-${cellId}-members.xlsx`;

      downloadFile(response.data, filename);
    } catch (error) {
      console.error('Failed to export cell members:', error);
      // Here you could show a notification to the user
      alert('멤버 명단 다운로드에 실패했습니다.');
    }
  },

  exportCellAttendances: async (cellId: number, startDate: string, endDate: string) => {
    try {
      const response = await api.get(`/export/cells/${cellId}/attendances.xlsx`, {
        params: { startDate, endDate },
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || `cell-${cellId}-attendances.xlsx`;

      downloadFile(response.data, filename);
    } catch (error) {
      console.error('Failed to export cell attendances:', error);
      alert('출석 현황 다운로드에 실패했습니다.');
    }
  },
};
