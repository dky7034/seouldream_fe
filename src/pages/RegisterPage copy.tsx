import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "../services/authService";
import type { CreateMemberRequest } from "../types";

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

  // State for username validation
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameValidationMsg, setUsernameValidationMsg] = useState("");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [hasUsernameBeenChecked, setHasUsernameBeenChecked] = useState(false);

  const navigate = useNavigate();

  const handleUsernameCheck = async () => {
    if (!formData.username) return;

    setIsCheckingUsername(true);
    setUsernameValidationMsg("");
    setHasUsernameBeenChecked(true); // Mark as checked
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

  // Password confirmation check
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
      // Reset validation status when username changes
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

    // Email validation
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }

    // Phone validation (digits and hyphens only)
    if (!/^[0-9-]+$/.test(formData.phone)) {
      newErrors.phone = "연락처는 숫자와 하이픈(-)만 입력 가능합니다.";
    }

    // Join year validation
    if (formData.joinYear && formData.joinYear > new Date().getFullYear()) {
      newErrors.joinYear = "등록 연도는 현재 연도보다 미래일 수 없습니다.";
    }

    // Password confirmation
    if (formData.password !== passwordConfirm) {
      newErrors.password = "비밀번호가 일치하지 않습니다.";
    }

    // Username checked
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
    setErrors({}); // Clear previous errors

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
          err.response?.data?.message ||
          "Registration failed. Please try again.",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 my-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          회원가입
        </h1>
        <div className="mt-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.submit && (
              <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
                {errors.submit}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                이름
              </label>
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                아이디
              </label>
              <div className="flex space-x-2">
                <input
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="flex-grow block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={handleUsernameCheck}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 whitespace-nowrap"
                  disabled={isCheckingUsername || !formData.username}
                >
                  {isCheckingUsername ? "확인 중..." : "중복 확인"}
                </button>
              </div>
              <div className="mt-2 text-sm h-5">
                {errors.username ? (
                  <p className="text-red-600">{errors.username}</p>
                ) : (
                  usernameValidationMsg && (
                    <p
                      className={
                        isUsernameAvailable ? "text-green-600" : "text-red-600"
                      }
                    >
                      {usernameValidationMsg}
                    </p>
                  )
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                연락처
              </label>
              <input
                name="phone"
                type="tel"
                placeholder="010-0000-0000"
                required
                value={formData.phone}
                onChange={handleChange}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              {errors.phone && (
                <p className="mt-2 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                비밀번호 확인
              </label>
              <input
                name="passwordConfirm"
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <div className="mt-2 text-sm h-5">
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

            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  성별
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="MALE">남성</option>
                  <option value="FEMALE">여성</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  생년월일
                </label>
                <input
                  name="birthDate"
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  교회 등록 연도
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
                  className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.joinYear && (
                  <p className="mt-2 text-sm text-red-600">{errors.joinYear}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  역할
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="MEMBER">셀원</option>
                  <option value="CELL_LEADER">셀장</option>
                  <option value="EXECUTIVE">임원</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                가입하기
              </button>
            </div>
          </form>
        </div>
        <p className="mt-6 text-sm text-center text-gray-600">
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
  );
};

export default RegisterPage;
