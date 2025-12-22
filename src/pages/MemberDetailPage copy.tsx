import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { memberService } from "../services/memberService";
import { prayerService } from "../services/prayerService";
import { teamService } from "../services/teamService";
import { attendanceService } from "../services/attendanceService";
import adminService from "../services/adminService"; // Import adminService
import type {
  MemberDto,
  PrayerDto,
  MemberAttendanceSummaryDto,
  TeamDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import MultiSelect from "../components/MultiSelect";
import ConfirmModal from "../components/ConfirmModal"; // Import ConfirmModal

// --- Sub-components for Member Details ---

const InfoCard: React.FC<{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, children, actions, className }) => (
  <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
      <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
      {actions}
    </div>
    <div className="border-t border-gray-200 px-4 py-5 sm:p-0">{children}</div>
  </div>
);

const InfoDl: React.FC<{ items: { dt: string; dd: React.ReactNode }[] }> = ({
  items,
}) => (
  <dl className="sm:divide-y sm:divide-gray-200">
    {items.map((item, index) => (
      <div
        key={index}
        className={`py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${
          index % 2 === 0 ? "bg-gray-50" : "bg-white"
        }`}
      >
        <dt className="text-sm font-medium text-gray-500">{item.dt}</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
          {item.dd}
        </dd>
      </div>
    ))}
  </dl>
);

const BasicInfoCard: React.FC<{
  member: MemberDto;
  isCurrentUser: boolean;
  onEditProfile: () => void;
}> = ({ member, isCurrentUser, onEditProfile }) => (
  <InfoCard
    title="기본 정보"
    actions={
      isCurrentUser && (
        <button
          onClick={onEditProfile}
          className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          내 프로필 수정
        </button>
      )
    }
  >
    <InfoDl
      items={[
        { dt: "이름", dd: member.name },
        { dt: "아이디", dd: member.username }, // Added username here
        { dt: "이메일", dd: member.email },
        { dt: "연락처", dd: member.phone },
        { dt: "생년월일", dd: `${member.birthDate} (${member.age}세)` },
        { dt: "주소", dd: member.address || "정보 없음" },
      ]}
    />
  </InfoCard>
);

const ChurchInfoCard: React.FC<{ member: MemberDto }> = ({ member }) => (
  <InfoCard title="교회 정보">
    <InfoDl
      items={[
        { dt: "셀", dd: member.cell?.name || "없음" },
        { dt: "역할", dd: translateRole(member.role) },
        { dt: "등록연도", dd: member.joinYear },
        {
          dt: "상태",
          dd: (
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                member.active
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {member.active ? "활동" : "비활동"}
            </span>
          ),
        },
      ]}
    />
  </InfoCard>
);

const TeamsCard: React.FC<{
  memberTeams: TeamDto[];
  onManageClick: () => void;
  canManage: boolean;
}> = ({ memberTeams, onManageClick, canManage }) => (
  <InfoCard
    title="소속 팀"
    actions={
      canManage && (
        <button
          onClick={onManageClick}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          + 팀 관리
        </button>
      )
    }
  >
    <div className="px-4 py-5">
      {memberTeams.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {memberTeams.map((t) => (
            <span
              key={t.id}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
            >
              {t.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">소속된 팀이 없습니다.</p>
      )}
    </div>
  </InfoCard>
);

const PrayersCard: React.FC<{ prayers: PrayerDto[] }> = ({ prayers }) => (
  <InfoCard title={`기도제목 (${prayers.length})`}>
    <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
      {prayers.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {prayers.map((p) => (
            <li key={p.id} className="px-4 py-4">
              <p className="text-sm text-gray-800">{p.content}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(p.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-gray-500">기도제목이 없습니다.</p>
      )}
    </div>
  </InfoCard>
);

const AttendanceSummaryCard: React.FC<{
  summary: MemberAttendanceSummaryDto | null;
  memberId: number;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  groupBy: "MONTH" | "DAY";
  onGroupByChange: (groupBy: "MONTH" | "DAY") => void;
}> = ({
  summary,
  memberId,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  // groupBy,
  // onGroupByChange,
}) => {
  const totalSummary = summary?.totalSummary;

  return (
    <InfoCard
      title="출석 요약"
      actions={
        <Link
          to={`/admin/users/${memberId}/attendance`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          전체 기록 보기
        </Link>
      }
    >
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="mt-1 p-2 w-full border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="mt-1 p-2 w-full border rounded-md"
            />
          </div>
        </div>

        {totalSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center border-t pt-4">
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm font-medium text-indigo-500">기간 출석률</p>
              <p className="mt-1 text-3xl font-semibold text-indigo-600">
                {totalSummary.attendanceRate.toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-600">출석</p>
              <p className="mt-1 text-3xl font-semibold text-green-700">
                {totalSummary.totalPresent}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-600">결석</p>
              <p className="mt-1 text-3xl font-semibold text-red-700">
                {totalSummary.totalAbsent}
              </p>
            </div>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-gray-500">
            출석 요약 데이터가 없습니다.
          </p>
        )}
      </div>
    </InfoCard>
  );
};

// --- Admin Actions Card ---
const AdminActionsCard: React.FC<{
  onResetPassword: () => void;
  isResetting: boolean;
}> = ({ onResetPassword, isResetting }) => (
  <InfoCard title="관리자 도구" className="border-l-4 border-red-500">
    <div className="p-6">
      <p className="text-sm text-gray-600 mb-4">
        주의: 아래 버튼은 사용자 계정에 직접적인 영향을 미칩니다.
      </p>
      <button
        onClick={onResetPassword}
        disabled={isResetting}
        className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-700 disabled:bg-red-300"
      >
        {isResetting ? "초기화 중..." : "비밀번호 강제 초기화"}
      </button>
    </div>
  </InfoCard>
);

// --- Modals ---
const TeamManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedTeamIds: number[]) => Promise<void>;
  memberName: string;
  allTeams: TeamDto[];
  memberTeams: TeamDto[];
}> = ({ isOpen, onClose, onSave, memberName, allTeams, memberTeams }) => {
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setSelectedTeamIds(memberTeams.map((t) => t.id));
  }, [isOpen, memberTeams]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(selectedTeamIds);
    setIsSaving(false);
    onClose();
  };

  const teamOptions = allTeams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">{memberName}님의 팀 관리</h2>
        <div className="mb-6 max-h-60 overflow-y-auto">
          <MultiSelect
            options={teamOptions}
            selectedValues={selectedTeamIds}
            onChange={setSelectedTeamIds}
          />
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            disabled={isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

const TempPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  password: string;
}> = ({ isOpen, onClose, password }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          임시 비밀번호 생성 완료
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          사용자에게 아래 임시 비밀번호를 전달하고, 로그인 후 즉시 비밀번호를
          변경하도록 안내해주세요.
        </p>
        <div className="p-3 bg-gray-100 rounded-md text-center">
          <p className="text-lg font-mono font-bold text-indigo-600">
            {password}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---

const MemberDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [member, setMember] = useState<MemberDto | null>(null);
  const [prayers, setPrayers] = useState<PrayerDto[]>([]);
  const [attendanceSummary, setAttendanceSummary] =
    useState<MemberAttendanceSummaryDto | null>(null);
  const [memberTeams, setMemberTeams] = useState<TeamDto[]>([]);
  const [allTeams, setAllTeams] = useState<TeamDto[]>([]);

  // Modals state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);

  // Password Reset State
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null
  );
  const [temporaryPassword, setTemporaryPassword] = useState<string>("");

  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [summaryEndDate, setSummaryEndDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [summaryGroupBy, setSummaryGroupBy] = useState<"MONTH" | "DAY">(
    "MONTH"
  );

  const memberIdNum = useMemo(() => (id ? Number(id) : null), [id]);

  const fetchMemberDetails = useCallback(async () => {
    if (!memberIdNum || !user) return;

    setLoading(true);
    try {
      const [memberData, prayerData, memberTeamsData, allTeamsPage] =
        await Promise.all([
          memberService.getMemberById(memberIdNum),
          prayerService.getPrayers({ memberId: memberIdNum }), // Changed from createdById to memberId
          memberService.getMemberTeams(memberIdNum),
          user.role === "EXECUTIVE"
            ? teamService.getAllTeams({})
            : Promise.resolve([]),
        ]);

      if (
        user.role !== "EXECUTIVE" &&
        user.role !== "CELL_LEADER" &&
        user.memberId !== memberData.id
      )
        throw new Error("권한이 없습니다.");
      if (user.role === "CELL_LEADER" && user.cellId !== memberData.cell?.id)
        throw new Error("자신이 속한 셀의 멤버 정보만 조회할 수 있습니다.");

      setMember(memberData);
      setPrayers(prayerData.content);
      setMemberTeams(memberTeamsData);
      setAllTeams("content" in allTeamsPage ? allTeamsPage.content : []);
    } catch (err: any) {
      setError(err.message || "멤버 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [memberIdNum, user]);

  const fetchAttendanceSummary = useCallback(async () => {
    if (!memberIdNum) return;
    try {
      const summaryData = await attendanceService.getMemberAttendanceSummary(
        memberIdNum,
        {
          startDate: summaryStartDate,
          endDate: summaryEndDate,
          groupBy: summaryGroupBy,
        }
      );
      setAttendanceSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch attendance summary:", err);
    }
  }, [memberIdNum, summaryStartDate, summaryEndDate, summaryGroupBy]);

  useEffect(() => {
    fetchMemberDetails();
  }, [fetchMemberDetails]);

  useEffect(() => {
    if (member) {
      fetchAttendanceSummary();
    }
  }, [member, fetchAttendanceSummary]);

  const handleTeamSave = useCallback(
    async (newTeamIds: number[]) => {
      if (!memberIdNum) return;

      const currentTeamIds = new Set(memberTeams.map((t) => t.id));
      const selectedTeamIds = new Set(newTeamIds);

      const toAdd = [...selectedTeamIds].filter(
        (tid) => !currentTeamIds.has(tid)
      );
      const toRemove = [...currentTeamIds].filter(
        (tid) => !selectedTeamIds.has(tid)
      );

      try {
        await Promise.all([
          ...toAdd.map((teamId) =>
            memberService.addMemberToTeam(memberIdNum, teamId)
          ),
          ...toRemove.map((teamId) =>
            memberService.removeMemberFromTeam(memberIdNum, teamId)
          ),
        ]);
        const updatedMemberTeams = await memberService.getMemberTeams(
          memberIdNum
        );
        setMemberTeams(updatedMemberTeams);
      } catch (error) {
        console.error("Failed to update teams:", error);
      }
    },
    [memberIdNum, memberTeams]
  );

  const handleResetPassword = async () => {
    if (!memberIdNum) return;
    setShowConfirmResetModal(false);
    setIsResettingPassword(true);
    setResetPasswordError(null);

    try {
      const response = await adminService.resetPassword(memberIdNum);
      setTemporaryPassword(response.temporaryPassword);
      setShowTempPasswordModal(true);
    } catch (error: any) {
      setResetPasswordError(
        error.response?.data?.message || "비밀번호 초기화에 실패했습니다."
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (loading) return <p className="mt-4 text-gray-600">로딩 중...</p>;
  if (error) return <p className="mt-4 text-red-600">{error}</p>;
  if (!member)
    return <p className="mt-4 text-red-600">멤버 정보를 찾을 수 없습니다.</p>;

  const canEdit =
    user && (user.role === "EXECUTIVE" || user.memberId === member.id);

  const isAdmin = user?.role === "EXECUTIVE";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {member.name} 상세 정보
        </h1>
        <div>
          {canEdit && (
            <button
              onClick={() => navigate(`/admin/users/${id}/edit`)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md mr-2"
            >
              수정
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
          >
            뒤로 가기
          </button>
        </div>
      </div>

      {resetPasswordError && (
        <div className="mb-4 p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {resetPasswordError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BasicInfoCard
            member={member}
            isCurrentUser={user?.memberId === member.id}
            onEditProfile={() => navigate("/my-profile")}
          />
          <AttendanceSummaryCard
            summary={attendanceSummary}
            memberId={member.id}
            startDate={summaryStartDate}
            endDate={summaryEndDate}
            onStartDateChange={setSummaryStartDate}
            onEndDateChange={setSummaryEndDate}
            groupBy={summaryGroupBy}
            onGroupByChange={setSummaryGroupBy}
          />
        </div>
        <div className="space-y-6">
          <ChurchInfoCard member={member} />
          <TeamsCard
            memberTeams={memberTeams}
            onManageClick={() => setIsTeamModalOpen(true)}
            canManage={user?.role === "EXECUTIVE"}
          />
          {isAdmin && (
            <AdminActionsCard
              onResetPassword={() => setShowConfirmResetModal(true)}
              isResetting={isResettingPassword}
            />
          )}
          <PrayersCard prayers={prayers} />
        </div>
      </div>

      <TeamManagementModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        onSave={handleTeamSave}
        memberName={member.name}
        allTeams={allTeams}
        memberTeams={memberTeams}
      />
      <ConfirmModal
        isOpen={showConfirmResetModal}
        onClose={() => setShowConfirmResetModal(false)}
        onConfirm={handleResetPassword}
        title="비밀번호 초기화 확인"
        message={`정말로 ${member.name}님의 비밀번호를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
      />
      <TempPasswordModal
        isOpen={showTempPasswordModal}
        onClose={() => setShowTempPasswordModal(false)}
        password={temporaryPassword}
      />
    </div>
  );
};

export default MemberDetailPage;
