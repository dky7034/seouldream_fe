import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "../services/authService";
import type { CreateMemberRequest } from "../types";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface FormErrors {
  email?: string;
  phone?: string;
  joinYear?: string;
  password?: string;
  username?: string;
  submit?: string;
}

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState<CreateMemberRequest>({
    name: "",
    username: "",
    password: "",
    gender: "MALE",
    birthDate: "",
    phone: "",
    email: "",
    role: "MEMBER",
    joinYear: new Date().getFullYear(),
    cellId: undefined,
    address: undefined,
    note: undefined,
  });
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [passwordMatchMsg, setPasswordMatchMsg] = useState<string>("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // username validation
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameValidationMsg, setUsernameValidationMsg] = useState("");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [hasUsernameBeenChecked, setHasUsernameBeenChecked] = useState(false);

  const navigate = useNavigate();

  const handleUsernameCheck = async () => {
    if (!formData.username) return;

    setIsCheckingUsername(true);
    setUsernameValidationMsg("");
    setHasUsernameBeenChecked(true);
    try {
      const isAvailable = await authService.checkUsername(formData.username);
      if (isAvailable) {
        setUsernameValidationMsg("사용 가능한 아이디입니다.");
        setIsUsernameAvailable(true);
      } else {
        setUsernameValidationMsg("이미 사용 중인 아이디입니다.");
        setIsUsernameAvailable(false);
      }
    } catch (err) {
      setUsernameValidationMsg("아이디 확인 중 오류가 발생했습니다.");
      setIsUsernameAvailable(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  useEffect(() => {
    if (passwordConfirm && formData.password) {
      if (formData.password === passwordConfirm) {
        setPasswordMatchMsg("비밀번호가 일치합니다.");
      } else {
        setPasswordMatchMsg("비밀번호가 일치하지 않습니다.");
      }
    } else {
      setPasswordMatchMsg("");
    }
  }, [formData.password, passwordConfirm]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "username") {
      setHasUsernameBeenChecked(false);
      setIsUsernameAvailable(false);
      setUsernameValidationMsg("");
    }

    if (name === "joinYear") {
      const parsedValue = parseInt(value, 10);
      setFormData((prev) => ({
        ...prev,
        [name]: isNaN(parsedValue) ? 0 : parsedValue,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};

    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    if (!/^[0-9-]+$/.test(formData.phone)) {
      newErrors.phone = "연락처는 숫자와 하이픈(-)만 입력 가능합니다.";
    }

    if (formData.joinYear && formData.joinYear > new Date().getFullYear()) {
      newErrors.joinYear = "등록 연도는 현재 연도보다 미래일 수 없습니다.";
    }

    if (formData.password !== passwordConfirm) {
      newErrors.password = "비밀번호가 일치하지 않습니다.";
    }

    if (!hasUsernameBeenChecked) {
      newErrors.username = "아이디 중복 확인을 해주세요.";
    } else if (!isUsernameAvailable) {
      newErrors.username =
        "사용할 수 없는 아이디입니다. 다른 아이디를 선택해주세요.";
    }

    return newErrors;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await authService.register(formData);
      navigate("/");
    } catch (err: any) {
      setErrors({
        submit:
          err?.response?.data?.message ||
          "회원가입에 실패했습니다. 다시 시도해주세요.",
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex items-center">
      <div className="w-full">
        <div className="max-w-md sm:max-w-lg mx-auto px-3 sm:px-4 py-8">
          <div className="w-full bg-white rounded-lg shadow-md px-5 sm:px-8 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900">
              회원가입
            </h1>

            <div className="mt-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {errors.submit && (
                  <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
                    {errors.submit}
                  </div>
                )}

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
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* 아이디 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    아이디 <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 flex flex-col sm:flex-row gap-2">
                    <input
                      name="username"
                      type="text"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      className="flex-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleUsernameCheck}
                      className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 whitespace-nowrap disabled:opacity-60"
                      disabled={isCheckingUsername || !formData.username}
                    >
                      {isCheckingUsername ? "확인 중..." : "중복 확인"}
                    </button>
                  </div>
                  <div className="mt-2 text-xs sm:text-sm min-h-[1.25rem]">
                    {errors.username ? (
                      <p className="text-red-600">{errors.username}</p>
                    ) : (
                      usernameValidationMsg && (
                        <p
                          className={
                            isUsernameAvailable
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {usernameValidationMsg}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    이메일
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.email && (
                    <p className="mt-2 text-xs sm:text-sm text-red-600">
                      {errors.email}
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
                    type="tel"
                    placeholder="숫자만 입력해 주세요 (예: 01012345678)"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.phone && (
                    <p className="mt-2 text-xs sm:text-sm text-red-600">
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                </div>

                {/* 비밀번호 확인 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    비밀번호 확인 <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      name="passwordConfirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      required
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPasswordConfirm ? (
                        <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 text-xs sm:text-sm min-h-[1.25rem]">
                    {errors.password ? (
                      <p className="text-red-600">{errors.password}</p>
                    ) : (
                      passwordMatchMsg && (
                        <p
                          className={
                            formData.password === passwordConfirm
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {passwordMatchMsg}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* 성별 / 생년월일 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      성별 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="mt-1 block w-full h-10 px-3 text-sm border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="MALE">남성</option>
                      <option value="FEMALE">여성</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      생년월일 <span className="text-red-500">*</span>
                    </label>

                    {/* ✅ 스타일: button 높이(h-10) 적용 및 placeholder 추가 */}
                    <div
                      className="mt-1
                        [&_.react-datepicker-wrapper]:w-full
                        [&_.react-datepicker__input-container]:w-full
                        [&_button]:!h-10
                        [&_button]:!flex
                        [&_button]:!items-center"
                    >
                      <KoreanCalendarPicker
                        value={formData.birthDate}
                        onChange={(dateStr) =>
                          setFormData((prev) => ({
                            ...prev,
                            birthDate: dateStr,
                          }))
                        }
                        maxDate={new Date()}
                        // ✅ 안내 문구
                        placeholder="생년월일을 선택해주세요"
                      />
                    </div>
                  </div>
                </div>

                {/* 등록 연도 / 역할 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      교회 등록 연도 <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="joinYear"
                      type="text"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      required
                      value={formData.joinYear === 0 ? "" : formData.joinYear}
                      onChange={handleChange}
                      placeholder="YYYY"
                      className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {errors.joinYear && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600">
                        {errors.joinYear}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      역할 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="MEMBER">셀원</option>
                      <option value="CELL_LEADER">셀장</option>
                      <option value="EXECUTIVE">임원</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="flex justify-center w-full px-4 py-2 text-sm font-semibold text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    가입하기
                  </button>
                </div>
              </form>
            </div>

            <p className="mt-6 text-xs sm:text-sm text-center text-gray-600">
              이미 계정이 있으신가요?{" "}
              <Link
                to="/"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
