import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import authService from "../services/authService";
import type { CreateMemberRequest, FormErrors, CellDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
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
    if (!user || user.role !== "EXECUTIVE") {
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
    if (debouncedUsername) {
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
        .finally(() => setIsCheckingUsername(false));
    } else {
      setUsernameAvailable(null);
    }
  }, [debouncedUsername]);

  // 비밀번호와 비밀번호 확인 실시간 검증
  useEffect(() => {
    if (formData.password && confirmPassword) {
      // 둘 다 입력되었을 때만 검증
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
      // 비밀번호 확인 필드가 비었을 때, 이전의 불일치 에러는 지움 (필수 입력 에러는 handleSubmit에서 처리)
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">새 멤버 추가</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {submitError}
          </div>
        )}

        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            계정 정보
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                아이디 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleFormChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {isCheckingUsername && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                    ...
                  </div>
                )}
              </div>
              {formErrors.username && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.username}
                </p>
              )}
              {usernameAvailable === true && (
                <p className="mt-1 text-sm text-green-600">
                  사용 가능한 아이디입니다.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.password}
                </p>
              )}
            </div>
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
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
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
                placeholder="숫자만 입력해 주세요 (예: 01012345678)"
                required
                value={formData.phone}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.birthDate && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.birthDate}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            교회 정보
          </legend>

          <div className="space-y-4">
            {/* 셀 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                셀
              </label>
              <div className="mt-1 md:mt-0 md:flex-1">
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
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.cellId}
                  </p>
                )}
              </div>
            </div>

            {/* 역할 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                역할
              </label>
              <div className="mt-1 md:mt-0 md:flex-1">
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="MEMBER">셀원</option>
                  <option value="CELL_LEADER">셀장</option>
                  <option value="EXECUTIVE">임원</option>
                </select>
              </div>
            </div>

            {/* 등록 연도 */}
            <div className="flex flex-col md:flex-row md:items-center">
              <label className="block text-sm font-medium text-gray-700 md:w-28">
                등록 연도 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 md:mt-0 md:flex-1">
                <input
                  name="joinYear"
                  type="number"
                  required
                  value={formData.joinYear}
                  onChange={handleFormChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {formErrors.joinYear && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.joinYear}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              메모
            </label>
            <textarea
              name="note"
              rows={3}
              value={formData.note}
              onChange={handleFormChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </fieldset>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
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
