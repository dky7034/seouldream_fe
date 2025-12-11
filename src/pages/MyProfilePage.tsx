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

// ───────────────── 공통 알림 타입 ─────────────────
type NotifyPayload = {
  type: "success" | "error";
  message: string;
};

// --- Sub-components ---

interface ProfileInfoCardProps {
  member: MemberDto;
  personalAttendanceRate: number | null;
}

const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  member,
  personalAttendanceRate,
}) => (
  <div className="bg-white shadow-lg rounded-lg p-5 sm:p-6 h-full">
    <div className="text-center">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
        {member.name}
      </h2>
      <p className="mt-1 text-sm text-gray-600 break-all">{member.email}</p>
    </div>
    <div className="mt-5 sm:mt-6 border-t border-gray-200 pt-5 sm:pt-6">
      <dl className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">생년월일</dt>
          <dd className="text-sm text-gray-900 text-right">
            {member.birthDate} (만 {member.age}세)
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">
            개인 출석률 (올해)
          </dt>
          <dd className="text-sm text-gray-900 text-right">
            {personalAttendanceRate !== null
              ? `${personalAttendanceRate.toFixed(1)}%`
              : "N/A"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">역할</dt>
          <dd className="text-sm text-gray-900 text-right">
            {translateRole(member.role)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">셀</dt>
          <dd className="text-sm text-gray-900 text-right">
            {member.cell?.name || "*소속 셀 없음"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">등록 연도</dt>
          <dd className="text-sm text-gray-900 text-right">
            {member.joinYear}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-gray-500">상태</dt>
          <dd className="text-sm text-gray-900 text-right">
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
  onNotify: (payload: NotifyPayload) => void;
}> = ({ member, onUpdate, onNotify }) => {
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
      const msg = "프로필 정보가 성공적으로 업데이트되었습니다.";
      setSuccess(msg);
      onNotify({ type: "success", message: msg });
      onUpdate();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "업데이트에 실패했습니다.";
      setError(msg);
      onNotify({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-5 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
        개인 정보 수정
      </h2>
      {success && <p className="text-sm text-green-600 mb-4">{success}</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
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
            className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm"
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
            className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm"
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
            className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm"
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
            className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm"
          />
        </div>
        <div className="text-right">
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

const ChangePasswordForm: React.FC<{
  onNotify: (payload: NotifyPayload) => void;
}> = ({ onNotify }) => {
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
      const msg = "현재 비밀번호를 먼저 검증해주세요.";
      setError(msg);
      onNotify({ type: "error", message: msg });
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
      const msg =
        "비밀번호가 성공적으로 변경되었습니다. 2초 후 로그아웃됩니다.";
      setSuccess(msg);
      onNotify({ type: "success", message: "비밀번호가 변경되었습니다." });
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "비밀번호 변경에 실패했습니다.";
      setError(msg);
      onNotify({ type: "error", message: msg });
      if (err?.response?.data?.message?.includes("현재 비밀번호")) {
        setIsCurrentPasswordVerified(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-5 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
        비밀번호 변경
      </h2>
      {success && <p className="text-sm text-green-600 mb-4">{success}</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
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
              className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md shadow-sm"
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
                  <p className="text-xs sm:text-sm text-red-600 truncate">
                    {verificationError}
                  </p>
                )}
                {isCurrentPasswordVerified && !verificationError && (
                  <p className="text-xs sm:text-sm text-green-600">
                    현재 비밀번호가 확인되었습니다.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleVerifyCurrentPassword}
                className={`px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white flex items-center justify-center
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
                    <ArrowPathIcon className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-1.5" />
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
                  className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md shadow-sm"
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
                <p className="mt-1 text-xs sm:text-sm text-red-600">
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
                  className="block w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md shadow-sm"
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
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <div className="text-right">
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:bg-red-300 disabled:cursor-not-allowed"
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

  const [notification, setNotification] = useState<NotifyPayload | null>(null);

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

  // 알림 자동 숨김 + 상단 스크롤
  const handleNotify = (payload: NotifyPayload) => {
    setNotification(payload);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!notification) return;
    const id = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(id);
  }, [notification]);

  // 로그인 자체가 안된 경우 최소한의 안내
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
          <p className="text-red-600 text-center">
            내 프로필 페이지는 로그인 후 이용할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
          <p className="text-gray-600">프로필 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
          <p className="text-red-600">멤버 정보를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              내 프로필
            </h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">
              내 기본 정보와 올해 출석률을 확인하고, 연락처/주소/비밀번호를
              관리할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 🔔 상단 알림 배너 */}
        {notification && (
          <div
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${
              notification.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1">
            <ProfileInfoCard
              member={member}
              personalAttendanceRate={personalAttendanceRate}
            />
          </div>
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            <EditProfileForm
              member={member}
              onUpdate={fetchMember}
              onNotify={handleNotify}
            />
            <ChangePasswordForm onNotify={handleNotify} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfilePage;
