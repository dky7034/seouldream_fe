// src/pages/AdminSemestersPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { semesterService } from "../services/semesterService";
import type {
  SemesterDto,
  CreateSemesterRequest,
  UpdateSemesterRequest,
} from "../types";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker"; // ✅ 전달주신 컴포넌트 임포트

const AdminSemestersPage: React.FC = () => {
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ✅ 초기값은 요청하신 대로 빈 문자열("")로 비워둡니다.
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

  // 삭제 모달 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<number | null>(null);

  // 알림 모달 상태
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalTitle, setAlertModalTitle] = useState("");
  const [alertModalMessage, setAlertModalMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertModalTitle(title);
    setAlertModalMessage(message);
    setIsAlertModalOpen(true);
  };

  const resetForm = () => {
    // ✅ 폼 초기화 시에도 날짜를 비워둡니다.
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

      // 시작일 기준 오름차순 정렬
      const sorted = [...data].sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
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

  // ✅ KoreanCalendarPicker는 선택된 날짜 문자열("YYYY-MM-DD")을 그대로 반환합니다.
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

    // 날짜 유효성 체크: 종료일 >= 시작일
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
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-8">
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

        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              학기 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              임원단이 생성하는 실제 학기 단위를 등록하고, 활성 상태를
              관리합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-xs sm:text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 생성/수정 폼 */}
        <div className="mb-8 rounded-lg bg-white p-4 sm:p-6 shadow">
          <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800">
            {isEditing ? "학기 수정" : "새 학기 추가"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-4 items-end"
          >
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
                placeholder="예: 2025년 봄학기"
              />
            </div>

            {/* 시작일 - 초기값은 "" 이며 비워져 있습니다. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                시작일 <span className="text-red-500">*</span>
              </label>
              <KoreanCalendarPicker
                value={form.startDate}
                onChange={(val) => handleDateStringChange("startDate", val)}
              />
            </div>

            {/* 종료일 - 초기값은 "" 이며 비워져 있습니다. */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                종료일 <span className="text-red-500">*</span>
              </label>
              <KoreanCalendarPicker
                value={form.endDate}
                onChange={(val) => handleDateStringChange("endDate", val)}
              />
            </div>

            <div className="md:col-span-4 flex flex-wrap items-center justify-end gap-2 pt-2">
              <div className="flex flex-wrap gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-gray-300 px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isEditing ? "수정 완료" : "+ 학기 추가"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 학기 목록 리스트 (모바일) */}
        <div className="space-y-3 md:hidden">
          {loading && semesters.length === 0 && (
            <div className="px-4 py-6 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-lg shadow">
              데이터를 불러오는 중입니다...
            </div>
          )}

          {!loading && semesters.length === 0 && (
            <div className="px-4 py-6 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-lg shadow">
              등록된 학기가 없습니다. 상단 폼에서 새 학기를 추가해주세요.
            </div>
          )}

          {semesters.map((semester) => (
            <div
              key={semester.id}
              className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900">
                    {semester.name}
                  </h3>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleActive(semester.id, !semester.isActive)
                    }
                    className={`${
                      semester.isActive ? "bg-green-500" : "bg-gray-300"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer 
               rounded-full border-2 border-transparent transition-colors 
               duration-200 ease-in-out focus:outline-none focus:ring-2 
               focus:ring-indigo-500 focus:ring-offset-2`}
                    role="switch"
                    aria-checked={semester.isActive}
                  >
                    <span className="sr-only">Toggle active status</span>
                    <span
                      aria-hidden="true"
                      className={`${
                        semester.isActive ? "translate-x-5" : "translate-x-0"
                      } pointer-events-none inline-block h-5 w-5 transform 
                 rounded-full bg-white shadow ring-0 transition duration-200 
                 ease-in-out`}
                    />
                  </button>
                  <span className="ml-2 text-[11px] text-gray-700">
                    {semester.isActive ? "활성" : "비활성"}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
                <div>
                  <p className="text-gray-400">시작일</p>
                  <p className="mt-0.5">{semester.startDate}</p>
                </div>
                <div>
                  <p className="text-gray-400">종료일</p>
                  <p className="mt-0.5">{semester.endDate}</p>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(semester)}
                  className="rounded-md border border-gray-300 px-3 py-1 
                     text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(semester.id)}
                  className="rounded-md bg-red-600 px-3 py-1 text-[11px] 
                     font-medium text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 학기 목록 테이블 (데스크탑) */}
        <div className="hidden md:block overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-500">
                  학기명
                </th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-500">
                  시작일
                </th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-500">
                  종료일
                </th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-500">
                  활성 상태
                </th>
                <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-500">
                  {/* 액션 */}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && semesters.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs sm:text-sm text-gray-500"
                  >
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              )}

              {!loading && semesters.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs sm:text-sm text-gray-500"
                  >
                    등록된 학기가 없습니다. 상단 폼에서 새 학기를 추가해주세요.
                  </td>
                </tr>
              )}

              {semesters.map((semester) => (
                <tr key={semester.id}>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                    {semester.name}
                  </td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                    {semester.startDate}
                  </td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                    {semester.endDate}
                  </td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                    <div className="flex items-center">
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
                            semester.isActive
                              ? "translate-x-5"
                              : "translate-x-0"
                          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                        />
                      </button>
                      <span className="ml-2 text-xs sm:text-sm text-gray-700">
                        {semester.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">
                    <button
                      type="button"
                      onClick={() => handleEdit(semester)}
                      className="mr-2 rounded-md border border-gray-300 px-3 py-1 text-[11px] sm:text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(semester.id)}
                      className="rounded-md bg-red-600 px-3 py-1 text-[11px] sm:text-xs font-medium text-white hover:bg-red-700"
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
    </div>
  );
};

export default AdminSemestersPage;
