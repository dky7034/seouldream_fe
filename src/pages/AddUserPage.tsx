// src/pages/AddUserPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import authService from "../services/authService";
import type { CreateMemberRequest, FormErrors, CellDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

// ✅ Custom hook for debouncing
const useDebounce = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const DEFAULT_PASSWORD = "password";

const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [formData, setFormData] = useState<CreateMemberRequest>({
    name: "",
    username: "", // ✅ [변경] 초기값 빈 문자열 (직접 입력)
    password: DEFAULT_PASSWORD,
    email: "",
    phone: "",
    gender: "MALE",
    birthDate: "",
    cellId: undefined,
    role: "MEMBER",
    joinYear: new Date().getFullYear(),
    address: "",
    note: "",
  });

  const [confirmPassword, setConfirmPassword] =
    useState<string>(DEFAULT_PASSWORD);

  const [cells, setCells] = useState<CellDto[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );

  // 입력된 username에 대해 0.5초 딜레이 후 중복 체크 수행
  const debouncedUsername = useDebounce(formData.username, 500);

  useEffect(() => {
    if (!user) return;

    if (user.role !== "EXECUTIVE") {
      navigate("/admin/users");
      return;
    }

    const queryParams = new URLSearchParams(location.search);
    const cellIdFromQuery = queryParams.get("cellId");
    if (cellIdFromQuery) {
      setFormData((prev) => ({ ...prev, cellId: Number(cellIdFromQuery) }));
    }

    const fetchCells = async () => {
      try {
        // ✅ 전체 셀 목록 조회 (size: 1000)
        const allCells = await cellService.getAllCells({ size: 1000 });
        setCells(allCells.content.filter((c) => c.active));
      } catch (err) {
        console.error("Failed to fetch cells:", err);
      }
    };
    fetchCells();
  }, [user, navigate, location.search]);

  // ✅ 아이디 중복 확인 효과 (Debounce 적용)
  useEffect(() => {
    // 아이디가 비어있으면 체크하지 않음
    if (!debouncedUsername) {
      setUsernameAvailable(null);
      setFormErrors((prev) => ({ ...prev, username: undefined }));
      return;
    }

    setIsCheckingUsername(true);
    authService
      .checkUsername(debouncedUsername)
      .then((isAvailable) => {
        setUsernameAvailable(isAvailable);
        if (!isAvailable) {
          setFormErrors((prev) => ({
            ...prev,
            username: "이미 사용 중인 아이디입니다.",
          }));
        } else {
          setFormErrors((prev) => ({ ...prev, username: undefined }));
        }
      })
      .catch((err) => {
        console.error("아이디 중복 확인 실패:", err);
        setUsernameAvailable(null);
        // 네트워크 에러 등은 일단 에러 메시지로 표시하지 않거나 필요 시 처리
      })
      .finally(() => setIsCheckingUsername(false));
  }, [debouncedUsername]);

  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells],
  );

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "password") return;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "joinYear" ? Number(value) : value,
    }));

    // 아이디가 변경되면 기존 중복 확인 결과 초기화
    if (name === "username") {
      setUsernameAvailable(null);
    }

    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleCellSelect = (cellId: number | undefined) => {
    setFormData((prev) => ({ ...prev, cellId }));
    setFormErrors((prev) => ({ ...prev, cellId: undefined }));
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    if (!formData.name) newErrors.name = "이름은 필수입니다.";

    if (!formData.username) newErrors.username = "아이디는 필수입니다.";
    // 한글 등 불가능한 문자 체크가 필요하다면 여기서 정규식 추가 (예: /^[a-zA-Z0-9]+$/)

    if (usernameAvailable === false)
      newErrors.username = "이미 사용 중인 아이디입니다.";

    if (!formData.password) newErrors.password = "비밀번호는 필수입니다.";
    if (formData.password !== confirmPassword)
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    if (!formData.phone) newErrors.phone = "연락처는 필수입니다.";
    else if (!/^\d+$/.test(formData.phone))
      newErrors.phone = "연락처는 숫자만 입력해 주세요.";

    if (!formData.birthDate) newErrors.birthDate = "생년월일은 필수입니다.";
    if (!formData.joinYear) newErrors.joinYear = "등록연도는 필수입니다.";

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const payload: CreateMemberRequest = {
      ...formData,
      password: DEFAULT_PASSWORD,
    };
    setConfirmPassword(DEFAULT_PASSWORD);

    setLoading(true);
    try {
      await memberService.createMember(payload);
      navigate("/admin/users");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "멤버 추가에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          멤버 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (user.role !== "EXECUTIVE") {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* 헤더 영역 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
          새 멤버 추가
        </h1>
        <p className="text-xs sm:text-sm text-gray-500">
          새로운 멤버의 계정 정보와 교회 정보를 입력해 주세요.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
      >
        {submitError && (
          <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* 계정 정보 */}
        <fieldset className="space-y-4 p-3 sm:p-4 border border-gray-200 rounded-xl">
          <legend className="px-1 text-base sm:text-lg font-semibold text-gray-900">
            계정 정보
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                아이디 <span className="text-red-500">*</span>
              </label>

              {/* ✅ [변경] 일반 Input으로 변경, 버튼 제거 */}
              <div className="mt-1 relative">
                <input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleFormChange}
                  placeholder="사용할 아이디를 입력하세요"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                             focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />

                {/* 로딩 인디케이터 (우측 끝) */}
                {isCheckingUsername && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-500 pointer-events-none">
                    <svg
                      className="animate-spin h-4 w-4 text-indigo-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* 상태 메시지 표시 */}
              {formErrors.username && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.username}
                </p>
              )}
              {/* 중복 체크 완료 & 사용 가능할 때 녹색 문구 */}
              {!isCheckingUsername &&
                formData.username &&
                usernameAvailable === true &&
                !formErrors.username && (
                  <p className="mt-1 text-xs sm:text-sm text-green-600">
                    사용 가능한 아이디입니다.
                  </p>
                )}
            </div>

            <div className="md:col-span-2">
              <div className="p-3 text-xs sm:text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md">
                비밀번호는 기본값으로{" "}
                <span className="font-semibold">{DEFAULT_PASSWORD}</span> 로
                자동 설정됩니다.
              </div>
            </div>
          </div>
        </fieldset>

        {/* 개인 정보 (이하 동일) */}
        <fieldset className="space-y-4 p-3 sm:p-4 border border-gray-200 rounded-xl">
          <legend className="px-1 text-base sm:text-lg font-semibold text-gray-900">
            개인 정보
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                           focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.name && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                           focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.email && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="숫자만 입력해 주세요"
                required
                value={formData.phone}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                           focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.phone && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.phone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                주소
              </label>
              <input
                name="address"
                type="text"
                value={formData.address}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                           focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                성별
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                           focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <KoreanCalendarPicker
                  value={formData.birthDate}
                  onChange={(next) => {
                    setFormData((prev) => ({ ...prev, birthDate: next }));
                    setFormErrors((prev) => ({
                      ...prev,
                      birthDate: undefined,
                    }));
                  }}
                  monthCols={3}
                  yearCols={4}
                />
              </div>
              {formErrors.birthDate && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.birthDate}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* 교회 정보 */}
        <fieldset className="space-y-4 p-3 sm:p-4 border border-gray-200 rounded-xl">
          <legend className="px-1 text-base sm:text-lg font-semibold text-gray-900">
            교회 정보
          </legend>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                셀
              </label>
              <div className="md:flex-1">
                <SimpleSearchableSelect
                  options={cellOptions}
                  value={formData.cellId}
                  onChange={(value) =>
                    handleCellSelect(
                      typeof value === "number" ? value : undefined,
                    )
                  }
                  placeholder="셀을 선택하세요..."
                />
                {formErrors.cellId && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">
                    {formErrors.cellId}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                역할
              </label>
              <div className="md:flex-1">
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                             focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="MEMBER">셀원</option>
                  <option value="CELL_LEADER">셀장</option>
                  <option value="EXECUTIVE">임원</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                등록 연도 <span className="text-red-500">*</span>
              </label>
              <div className="md:flex-1">
                <input
                  name="joinYear"
                  type="number"
                  required
                  value={formData.joinYear}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm
                             focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {formErrors.joinYear && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">
                    {formErrors.joinYear}
                  </p>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* 버튼 */}
        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400
                       disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            취소
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                       disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={
              loading ||
              isCheckingUsername ||
              (!!formData.username && usernameAvailable === false)
            }
          >
            {loading ? "저장 중..." : "멤버 생성"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddUserPage;
