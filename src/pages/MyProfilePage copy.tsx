// src/pages/MyProfilePage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { profileService } from "../services/profileService";
import { attendanceService } from "../services/attendanceService";
import type {
  MemberDto,
  UpdateMyProfileRequest,
  ChangePasswordRequest,
  FormErrors,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import {
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";

// --- Sub-components ---

interface ProfileInfoCardProps {
  member: MemberDto;
  personalAttendanceRate: number | null;
}

const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  member,
  personalAttendanceRate,
}) => (
  <div className="bg-white shadow-lg rounded-lg p-6 h-full">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-800">{member.name}</h2>
      <p className="text-gray-600">{member.email}</p>
    </div>
    <div className="mt-6 border-t border-gray-200 pt-6">
      <dl className="space-y-4">
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">생년월일</dt>
          <dd className="text-sm text-gray-900">
            {member.birthDate} (만 {member.age}세)
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">
            개인 출석률 (올해)
          </dt>
          <dd className="text-sm text-gray-900">
            {personalAttendanceRate !== null
              ? `${personalAttendanceRate.toFixed(1)}%`
              : "N/A"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">역할</dt>
          <dd className="text-sm text-gray-900">
            {translateRole(member.role)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">셀</dt>
          <dd className="text-sm text-gray-900">
            {member.cell?.name || "*소속 셀 없음"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">등록 연도</dt>
          <dd className="text-sm text-gray-900">{member.joinYear}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm font-medium text-gray-500">상태</dt>
          <dd className="text-sm text-gray-900">
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                member.active
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {member.active ? "활동" : "비활동"}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  </div>
);

const EditProfileForm: React.FC<{
  member: MemberDto;
  onUpdate: () => void;
}> = ({ member, onUpdate }) => {
  const [formData, setFormData] = useState<UpdateMyProfileRequest>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFormData({
      phone: member.phone,
      email: member.email,
      address: member.address,
      note: member.note,
    });
  }, [member]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await profileService.updateMyProfile(formData);
      setSuccess("프로필 정보가 성공적으로 업데이트되었습니다.");
      onUpdate();
    } catch (err: any) {
      setError(err?.response?.data?.message || "업데이트에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">개인 정보 수정</h2>
      {success && <p className="text-green-600 mb-4">{success}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            연락처
          </label>
          <input
            name="phone"
            type="tel"
            value={formData.phone || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            이메일
          </label>
          <input
            name="email"
            type="email"
            value={formData.email || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            주소
          </label>
          <input
            name="address"
            type="text"
            value={formData.address || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            메모
          </label>
          <textarea
            name="note"
            rows={3}
            value={formData.note || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div className="text-right">
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
            disabled={loading}
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

const ChangePasswordForm: React.FC = () => {
  const { logout } = useAuth();
  const [formData, setFormData] = useState<ChangePasswordRequest>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [isVerifying, setIsVerifying] = useState(false);
  const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] =
    useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (
      formData.newPassword &&
      formData.confirmPassword &&
      formData.newPassword !== formData.confirmPassword
    ) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "새 비밀번호가 일치하지 않습니다.",
      }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
    }
  }, [formData.newPassword, formData.confirmPassword]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "currentPassword") {
      setIsCurrentPasswordVerified(false);
      setVerificationError(null);
    }
  };

  const handleVerifyCurrentPassword = async () => {
    if (!formData.currentPassword) {
      setVerificationError("현재 비밀번호를 입력해주세요.");
      return;
    }
    setIsVerifying(true);
    setVerificationError(null);
    try {
      await profileService.verifyPassword(formData.currentPassword);
      setIsCurrentPasswordVerified(true);
    } catch (err: any) {
      setIsCurrentPasswordVerified(false);
      setVerificationError(
        err?.response?.data?.message || "현재 비밀번호가 올바르지 않습니다."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isCurrentPasswordVerified) {
      setError("현재 비밀번호를 먼저 검증해주세요.");
      return;
    }

    const newErrors: FormErrors = {};
    if (!formData.currentPassword)
      newErrors.currentPassword = "현재 비밀번호를 입력해주세요.";
    if (!formData.newPassword || formData.newPassword.length < 6)
      newErrors.newPassword = "새 비밀번호는 6자 이상이어야 합니다.";
    if (formData.newPassword !== formData.confirmPassword)
      newErrors.confirmPassword = "새 비밀번호가 일치하지 않습니다.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { currentPassword, newPassword } = formData;
      await profileService.changePassword({ currentPassword, newPassword });
      setSuccess(
        "비밀번호가 성공적으로 변경되었습니다. 2초 후 로그아웃됩니다."
      );
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "비밀번호 변경에 실패했습니다.");
      if (err?.response?.data?.message?.includes("현재 비밀번호")) {
        setIsCurrentPasswordVerified(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">비밀번호 변경</h2>
      {success && <p className="text-green-600 mb-4">{success}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 현재 비밀번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            현재 비밀번호
          </label>
          <div className="mt-1 relative">
            <input
              name="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              required
              value={formData.currentPassword}
              onChange={handleChange}
              className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm"
              disabled={isCurrentPasswordVerified}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showCurrentPassword ? (
                <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <EyeIcon className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                {verificationError && (
                  <p className="text-sm text-red-600 truncate">
                    {verificationError}
                  </p>
                )}
                {isCurrentPasswordVerified && !verificationError && (
                  <p className="text-sm text-green-600">
                    현재 비밀번호가 확인되었습니다.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleVerifyCurrentPassword}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white flex items-center justify-center
                  ${
                    isCurrentPasswordVerified
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }
                  ${
                    isVerifying || isCurrentPasswordVerified
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                disabled={isVerifying || isCurrentPasswordVerified}
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center">
                    <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                    검증 중...
                  </span>
                ) : isCurrentPasswordVerified ? (
                  "비밀번호 확인 완료"
                ) : (
                  "비밀번호 확인"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 새 비밀번호 입력 영역 */}
        <fieldset disabled={!isCurrentPasswordVerified}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                새 비밀번호
              </label>
              <div className="mt-1 relative">
                <input
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.newPassword}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                새 비밀번호 확인
              </label>
              <div className="mt-1 relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm"
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
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <div className="text-right">
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-md disabled:bg-red-300"
            disabled={loading || !isCurrentPasswordVerified}
          >
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Main Page Component ---

const MyProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState<MemberDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [personalAttendanceRate, setPersonalAttendanceRate] = useState<
    number | null
  >(null);

  const fetchMember = useCallback(async () => {
    if (!user) {
      navigate("/");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const memberData = await profileService.getMyProfile();
      setMember(memberData);
    } catch (err: any) {
      setError("프로필 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  const fetchPersonalAttendanceRate = useCallback(async () => {
    if (!user || !user.memberId) return;
    try {
      const currentYear = new Date().getFullYear();
      const summary = await attendanceService.getMemberAttendanceSummary(
        user.memberId,
        { year: currentYear }
      );

      const rate = summary?.totalSummary?.attendanceRate ?? null;

      setPersonalAttendanceRate(typeof rate === "number" ? rate : null);
    } catch (err) {
      console.error("Failed to fetch personal attendance rate:", err);
      setPersonalAttendanceRate(null);
    }
  }, [user]);

  useEffect(() => {
    fetchMember();
    fetchPersonalAttendanceRate();
  }, [fetchMember, fetchPersonalAttendanceRate]);

  // 로그인 자체가 안된 경우 최소한의 안내
  if (!user) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <p className="text-red-600 text-center">
          내 프로필 페이지는 로그인 후 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <p className="text-gray-600">프로필 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <p className="text-red-600">멤버 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            내 프로필
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            내 기본 정보와 올해 출석률을 확인하고, 연락처/주소/비밀번호를 관리할
            수 있습니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ProfileInfoCard
            member={member}
            personalAttendanceRate={personalAttendanceRate}
          />
        </div>
        <div className="lg:col-span-2 space-y-8">
          <EditProfileForm member={member} onUpdate={fetchMember} />
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
};

export default MyProfilePage;
