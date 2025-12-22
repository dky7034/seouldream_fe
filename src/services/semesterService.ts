import api from "./api";
import type {
  SemesterDto,
  CreateSemesterRequest,
  UpdateSemesterRequest,
} from "../types";

export const semesterService = {
  getAllSemesters: async (isActive?: boolean): Promise<SemesterDto[]> => {
    try {
      const response = await api.get("/semesters", { params: { isActive } });
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to fetch semesters:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getSemesterById: async (id: number): Promise<SemesterDto> => {
    try {
      const response = await api.get(`/semesters/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to fetch semester ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  createSemester: async (data: CreateSemesterRequest): Promise<SemesterDto> => {
    try {
      const response = await api.post("/semesters", data);
      return response.data;
    } catch (error: any) {
      console.error(
        "Failed to create semester:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updateSemester: async (
    id: number,
    data: UpdateSemesterRequest
  ): Promise<SemesterDto> => {
    try {
      const response = await api.patch(`/semesters/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(
        `Failed to update semester ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },

  deleteSemester: async (id: number): Promise<void> => {
    try {
      await api.delete(`/semesters/${id}`);
    } catch (error: any) {
      console.error(
        `Failed to delete semester ${id}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  },
};
