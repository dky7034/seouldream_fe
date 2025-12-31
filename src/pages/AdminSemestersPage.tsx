import React, { useEffect, useState, useCallback } from "react";
import { semesterService } from "../services/semesterService";
import type {
  SemesterDto,
  CreateSemesterRequest,
  UpdateSemesterRequest,
} from "../types";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import {
  CalendarDaysIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";

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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<number | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalTitle, setAlertModalTitle] = useState("");
  const [alertModalMessage, setAlertModalMessage] = useState("");

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const targetStr =
      dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
    const date = new Date(targetStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const showAlert = (title: string, message: string) => {
    setAlertModalTitle(title);
    setAlertModalMessage(message);
    setIsAlertModalOpen(true);
  };

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
      const sorted = [...data].sort((a, b) =>
        b.startDate.localeCompare(a.startDate)
      );
      setSemesters(sorted);
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

  const handleDateStringChange = (
    field: "startDate" | "endDate",
    val: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      showAlert("입력 오류", "학기명, 시작일, 종료일을 모두 입력해주세요.");
      return;
    }
    if (form.endDate < form.startDate) {
      showAlert("입력 오류", "종료일은 시작일 이후여야 합니다.");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteClick = (id: number) => {
    setSemesterToDelete(id);
    setIsDeleteModalOpen(true);
  };

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
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AlertModal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          title={alertModalTitle}
          message={alertModalMessage}
        />

        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="학기 삭제"
          message="정말 이 학기를 삭제하시겠습니까?"
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="h-7 w-7 text-indigo-500" />
              학기 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              학기 단위를 등록하고 활성 상태를 관리합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </div>
        )}

        {/* Create/Edit Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
            {isEditing ? (
              <PencilIcon className="h-5 w-5 text-indigo-500" />
            ) : (
              <PlusIcon className="h-5 w-5 text-gray-400" />
            )}
            <h3 className="font-bold text-gray-700">
              {isEditing ? "학기 정보 수정" : "새 학기 등록"}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  학기명 <span className="text-red-500">*</span>
                </label>

                {/* ✅ mt-1 추가로 시작일/종료일과 같은 “윗선”으로 정렬 */}
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                  placeholder="예: 2025년 봄학기"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">
                  시작일 <span className="text-red-500">*</span>
                </label>

                {/* ✅ picker는 margin을 갖지 않으므로 여기서 mt-1 부여 */}
                <div className="mt-1">
                  <KoreanCalendarPicker
                    value={form.startDate}
                    onChange={(val) => handleDateStringChange("startDate", val)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">
                  종료일 <span className="text-red-500">*</span>
                </label>

                <div className="mt-1">
                  <KoreanCalendarPicker
                    value={form.endDate}
                    onChange={(val) => handleDateStringChange("endDate", val)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-4">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isEditing ? (
                  <>
                    <CheckIcon className="h-4 w-4" /> 수정 완료
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" /> 학기 추가
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* List Section */}
        {loading && semesters.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : !loading && semesters.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            등록된 학기가 없습니다.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {semesters.map((semester) => (
                <div
                  key={semester.id}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-all ${
                    !semester.isActive ? "opacity-75 bg-gray-50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-900">
                      {semester.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleActive(semester.id, !semester.isActive)
                      }
                      className={`${
                        semester.isActive ? "bg-green-500" : "bg-gray-300"
                      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                    >
                      <span className="sr-only">Toggle active status</span>
                      <span
                        aria-hidden="true"
                        className={`${
                          semester.isActive ? "translate-x-5" : "translate-x-0"
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl mb-3">
                    <div>
                      <span className="block text-gray-400 font-bold mb-1">
                        시작일
                      </span>
                      {safeFormatDate(semester.startDate)}
                    </div>
                    <div>
                      <span className="block text-gray-400 font-bold mb-1">
                        종료일
                      </span>
                      {safeFormatDate(semester.endDate)}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                    <button
                      type="button"
                      onClick={() => handleEdit(semester)}
                      className="bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50 flex items-center gap-1"
                    >
                      <PencilIcon className="h-3 w-3" /> 수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(semester.id)}
                      className="bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50 flex items-center gap-1"
                    >
                      <TrashIcon className="h-3 w-3" /> 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      학기명
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      시작일
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      종료일
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      상태
                    </th>
                    <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs">
                      {/* 관리 */}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {semesters.map((semester) => (
                    <tr
                      key={semester.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {semester.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {safeFormatDate(semester.startDate)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {safeFormatDate(semester.endDate)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleActive(
                                semester.id,
                                !semester.isActive
                              )
                            }
                            className={`${
                              semester.isActive ? "bg-green-500" : "bg-gray-300"
                            } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                          >
                            <span
                              aria-hidden="true"
                              className={`${
                                semester.isActive
                                  ? "translate-x-4"
                                  : "translate-x-0"
                              } pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                          </button>
                          <span
                            className={`text-xs font-bold ${
                              semester.isActive
                                ? "text-green-600"
                                : "text-gray-400"
                            }`}
                          >
                            {semester.isActive ? "활성" : "비활성"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(semester)}
                            className="text-gray-400 hover:text-indigo-600 font-bold text-xs"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteClick(semester.id)}
                            className="text-gray-400 hover:text-red-500 font-bold text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminSemestersPage;
