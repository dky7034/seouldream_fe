import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import authService from "../services/authService";
import type { CreateMemberRequest, FormErrors, CellDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// ✅ Custom hook for debouncing (타입 명시)
const useDebounce = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [formData, setFormData] = useState<CreateMemberRequest>({
    name: "",
    username: "",
    password: "",
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cells, setCells] = useState<CellDto[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Username availability check state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const debouncedUsername = useDebounce(formData.username, 500);

  useEffect(() => {
    if (!user) return;

    if (user.role !== "EXECUTIVE") {
      navigate("/admin/users");
      return;
    }

    // Set cell from query parameter
    const queryParams = new URLSearchParams(location.search);
    const cellIdFromQuery = queryParams.get("cellId");
    if (cellIdFromQuery) {
      setFormData((prev) => ({ ...prev, cellId: Number(cellIdFromQuery) }));
    }

    const fetchCells = async () => {
      try {
        const allCells = await cellService.getAllCells({});
        setCells(allCells.content.filter((c) => c.active));
      } catch (err) {
        console.error("Failed to fetch cells:", err);
      }
    };
    fetchCells();
  }, [user, navigate, location.search]);

  // Effect for checking username availability
  useEffect(() => {
    if (!debouncedUsername) {
      setUsernameAvailable(null);
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
        setFormErrors((prev) => ({
          ...prev,
          username: "아이디 중복 여부를 확인할 수 없습니다.",
        }));
      })
      .finally(() => setIsCheckingUsername(false));
  }, [debouncedUsername]);

  // 비밀번호와 비밀번호 확인 실시간 검증
  useEffect(() => {
    if (formData.password && confirmPassword) {
      if (formData.password !== confirmPassword) {
        setFormErrors((prev) => ({
          ...prev,
          confirmPassword: "비밀번호가 일치하지 않습니다.",
        }));
      } else {
        setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
      }
    } else if (
      !confirmPassword &&
      formErrors.confirmPassword === "비밀번호가 일치하지 않습니다."
    ) {
      setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  }, [formData.password, confirmPassword, formErrors.confirmPassword]);

  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "joinYear" ? Number(value) : value,
    }));
    if (name === "username") {
      setUsernameAvailable(null); // Reset on change
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
    if (usernameAvailable === false)
      newErrors.username = "이미 사용 중인 아이디입니다.";

    if (!formData.password) newErrors.password = "비밀번호는 필수입니다.";
    else if (formData.password.length < 6)
      newErrors.password = "비밀번호는 6자 이상이어야 합니다.";

    if (!confirmPassword)
      newErrors.confirmPassword = "비밀번호 확인은 필수입니다.";
    if (formData.password !== confirmPassword)
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "올바른 이메일 형식이 아닙니다.";

    if (!formData.phone) newErrors.phone = "연락처는 필수입니다.";
    else if (!/^\d+$/.test(formData.phone))
      newErrors.phone = "연락처는 숫자만 입력해 주세요.";

    if (!formData.birthDate) newErrors.birthDate = "생년월일은 필수입니다.";
    if (!formData.joinYear) newErrors.joinYear = "등록연도는 필수입니다.";

    if (formData.role === "CELL_LEADER" && !formData.cellId) {
      newErrors.cellId = "셀장은 반드시 셀에 소속되어야 합니다.";
    }

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

    setLoading(true);
    try {
      await memberService.createMember(formData);
      navigate("/admin/users");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "멤버 추가에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ auth / 권한 가드
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          사용자 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  if (user.role !== "EXECUTIVE") {
    // useEffect에서 이미 리다이렉트 중이므로 여기서는 렌더링만 막기
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

      {/* 카드형 폼 */}
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
            {/* 아이디 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                아이디 <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {isCheckingUsername && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-500">
                    확인 중...
                  </div>
                )}
              </div>
              {formErrors.username && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.username}
                </p>
              )}
              {usernameAvailable === true && !formErrors.username && (
                <p className="mt-1 text-xs sm:text-sm text-green-600">
                  사용 가능한 아이디입니다.
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {formErrors.password && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.password}
                </p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {formErrors.confirmPassword && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* 개인 정보 */}
        <fieldset className="space-y-4 p-3 sm:p-4 border border-gray-200 rounded-xl">
          <legend className="px-1 text-base sm:text-lg font-semibold text-gray-900">
            개인 정보
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 이름 */}
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.name && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.email && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.email}
                </p>
              )}
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="숫자만 입력해 주세요 (예: 01012345678)"
                required
                value={formData.phone}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.phone && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.phone}
                </p>
              )}
            </div>

            {/* 주소 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                주소
              </label>
              <input
                name="address"
                type="text"
                value={formData.address}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                성별
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>

            {/* 생년월일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <input
                name="birthDate"
                type="date"
                required
                value={formData.birthDate}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
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
            {/* 셀 */}
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
                      typeof value === "number" ? value : undefined
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

            {/* 역할 */}
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                역할
              </label>
              <div className="md:flex-1">
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="MEMBER">셀원</option>
                  <option value="CELL_LEADER">셀장</option>
                  <option value="EXECUTIVE">임원</option>
                </select>
              </div>
            </div>

            {/* 등록 연도 */}
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
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {formErrors.joinYear && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">
                    {formErrors.joinYear}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700">
              메모
            </label>
            <textarea
              name="note"
              rows={3}
              value={formData.note}
              onChange={handleFormChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </fieldset>

        {/* 버튼 */}
        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={
              loading ||
              isCheckingUsername ||
              usernameAvailable === false ||
              !!formErrors.confirmPassword
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
