// src/pages/AdminSemestersPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { semesterService } from "../services/semesterService";
import type {
  SemesterDto,
  CreateSemesterRequest,
  UpdateSemesterRequest,
} from "../types";
import ConfirmModal from "../components/ConfirmModal";

const AdminSemestersPage: React.FC = () => {
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>({
    name: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  // 🔹 삭제 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<number | null>(null);

  const resetForm = () => {
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      isActive: true,
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const loadSemesters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await semesterService.getAllSemesters();
      setSemesters(data);
    } catch (e) {
      console.error(e);
      setError("학기 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.startDate || !form.endDate) {
      alert("학기명, 시작일, 종료일을 모두 입력해주세요.");
      return;
    }

    const payload: CreateSemesterRequest | UpdateSemesterRequest = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: form.isActive,
    };

    try {
      setLoading(true);
      setError(null);

      if (isEditing && editingId !== null) {
        await semesterService.updateSemester(editingId, payload);
      } else {
        await semesterService.createSemester(payload as CreateSemesterRequest);
      }

      await loadSemesters();
      resetForm();
    } catch (e) {
      console.error(e);
      setError("학기 정보를 저장하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (semester: SemesterDto) => {
    setIsEditing(true);
    setEditingId(semester.id);
    setForm({
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      isActive: semester.isActive,
    });
  };

  // 🔹 삭제 버튼 클릭 시: 모달만 열고, 실제 삭제는 별도 confirm handler에서 수행
  const handleDeleteClick = (id: number) => {
    setSemesterToDelete(id);
    setIsDeleteModalOpen(true);
  };

  // 🔹 모달에서 "삭제" 확인 눌렀을 때 실제 삭제 처리
  const handleConfirmDelete = async () => {
    if (semesterToDelete == null) return;

    try {
      setLoading(true);
      setError(null);
      await semesterService.deleteSemester(semesterToDelete);
      await loadSemesters();
    } catch (e) {
      console.error(e);
      setError("학기를 삭제하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setIsDeleteModalOpen(false);
      setSemesterToDelete(null);
    }
  };

  const handleToggleActive = async (id: number, newStatus: boolean) => {
    try {
      setLoading(true);
      setError(null);
      await semesterService.updateSemester(id, { isActive: newStatus });
      await loadSemesters();
    } catch (e) {
      console.error(e);
      setError("학기 활성 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 🔹 삭제 ConfirmModal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="학기 삭제"
        message="정말 이 학기를 삭제하시겠습니까?"
      />

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">학기 관리</h1>
          <p className="mt-1 text-sm text-gray-600">
            학기(1학기, 2학기, 상반기, 하반기 등)를 등록하고 수정/삭제합니다.
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 생성/수정 폼 */}
      <div className="mb-8 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">
          {isEditing ? "학기 수정" : "새 학기 추가"}
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              학기명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="예: 2025년 1학기, 2025년 상반기"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              종료일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-4 flex justify-end space-x-2">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isEditing ? "수정 완료" : "학기 추가"}
            </button>
          </div>
        </form>
      </div>

      {/* 학기 목록 테이블 */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                학기명
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                시작일
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                종료일
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                활성 상태
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {/* 액션 */}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading && semesters.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  데이터를 불러오는 중입니다...
                </td>
              </tr>
            )}

            {!loading && semesters.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  등록된 학기가 없습니다. 상단 폼에서 새 학기를 추가해주세요.
                </td>
              </tr>
            )}

            {semesters.map((semester) => (
              <tr key={semester.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {semester.id}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {semester.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {semester.startDate}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {semester.endDate}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleActive(semester.id, !semester.isActive)
                    }
                    className={`${
                      semester.isActive ? "bg-green-500" : "bg-gray-300"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                    role="switch"
                    aria-checked={semester.isActive}
                  >
                    <span className="sr-only">Toggle active status</span>
                    <span
                      aria-hidden="true"
                      className={`${
                        semester.isActive ? "translate-x-5" : "translate-x-0"
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                  <span className="ml-2 text-sm text-gray-700">
                    {semester.isActive ? "활성" : "비활성"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                  <button
                    type="button"
                    onClick={() => handleEdit(semester)}
                    className="mr-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(semester.id)}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSemestersPage;
