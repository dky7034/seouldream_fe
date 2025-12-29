import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { teamService } from "../services/teamService";
import { memberService } from "../services/memberService";
import type { TeamDto, MemberDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import AlertModal from "../components/AlertModal";
import {
  formatNameWithBirthdate,
  formatDisplayName,
} from "../utils/memberUtils";
import {
  UserCircleIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";

// ── [컴포넌트] 멤버 추가 모달 ─────────────────────────────
const AddMembersToTeamModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberIds: number[]) => Promise<void>;
  existingMembers: MemberDto[];
}> = ({ isOpen, onClose, onSave, existingMembers }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [potentialMembers, setPotentialMembers] = useState<MemberDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchInitialMembers = async () => {
        setIsLoading(true);
        try {
          const existingMemberIds = new Set(existingMembers.map((m) => m.id));
          const response = await memberService.getAllMembers({
            page: 0,
            size: 1000,
            active: true,
          });
          setPotentialMembers(
            response.content.filter(
              (member) => !existingMemberIds.has(member.id)
            )
          );
        } catch (error) {
          console.error("Failed to fetch initial members:", error);
          setPotentialMembers([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialMembers();
    } else {
      setSearchTerm("");
      setPotentialMembers([]);
      setSelectedMemberIds(new Set());
      setIsSubmitting(false);
    }
  }, [isOpen, existingMembers]);

  const filteredMembers = potentialMembers.filter(
    (member) =>
      formatNameWithBirthdate(member)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleMemberSelection = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) newSet.delete(memberId);
      else newSet.add(memberId);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (selectedMemberIds.size === 0) return;
    setIsSubmitting(true);
    await onSave(Array.from(selectedMemberIds));
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlusIcon className="h-5 w-5 text-indigo-600" />팀 멤버 추가
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* 검색창 영역 */}
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            autoFocus
          />
        </div>

        {/* 리스트 영역 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {potentialMembers.length === 0
                ? "추가할 수 있는 멤버가 없습니다."
                : "검색 결과가 없습니다."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.id);
                return (
                  <li key={member.id}>
                    <label
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50 border border-indigo-100"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleMemberSelection(member.id)}
                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors"
                      />
                      <div className="ml-3">
                        <span
                          className={`block text-sm font-medium ${
                            isSelected ? "text-indigo-900" : "text-gray-900"
                          }`}
                        >
                          {formatNameWithBirthdate(member)}
                        </span>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
          <span className="text-sm font-medium text-gray-600">
            <strong className="text-indigo-600">
              {selectedMemberIds.size}
            </strong>
            명 선택됨
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
              disabled={selectedMemberIds.size === 0 || isSubmitting}
            >
              {isSubmitting ? "추가 중..." : "추가하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── [페이지] 팀 상세 정보 ─────────────────────────────
const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const [alertInfo, setAlertInfo] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: "", message: "" });

  useEffect(() => {
    const fetchTeamDetails = async () => {
      const numericId = id ? Number(id) : NaN;
      if (!id || Number.isNaN(numericId)) {
        setError("유효하지 않은 팀 ID입니다.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [teamData, memberData] = await Promise.all([
          teamService.getTeamById(numericId),
          teamService.getTeamMembers(numericId),
        ]);
        setTeam(teamData);
        setMembers(memberData);
      } catch (err) {
        console.error("Failed to fetch team details:", err);
        setError("팀 정보를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchTeamDetails();
  }, [id]);

  const handleAddMembers = async (memberIds: number[]) => {
    const numericId = id ? Number(id) : NaN;
    if (Number.isNaN(numericId) || memberIds.length === 0) return;
    try {
      await teamService.addMembersToTeam(numericId, memberIds);
      const updatedMembers = await teamService.getTeamMembers(numericId);
      setMembers(updatedMembers);
      setAlertInfo({
        isOpen: true,
        title: "성공",
        message: "멤버가 성공적으로 추가되었습니다.",
      });
    } catch (error) {
      setAlertInfo({
        isOpen: true,
        title: "오류",
        message: "멤버 추가에 실패했습니다.",
      });
    }
  };

  const closeAlert = () => {
    setAlertInfo({ isOpen: false, title: "", message: "" });
  };

  const canModify = user?.role === "EXECUTIVE";

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-sm w-full">
          <p className="text-red-600 mb-4 text-sm font-medium">
            {error || "팀 정보를 찾을 수 없습니다."}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <AlertModal
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />
      <AddMembersToTeamModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onSave={handleAddMembers}
        existingMembers={members}
      />

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* 상단 헤더 영역 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              {team.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              팀의 상세 정보와 소속된 멤버를 관리합니다.
            </p>
          </div>
          <div className="flex gap-2">
            {canModify && (
              <button
                onClick={() => navigate(`/admin/teams/${team.id}/edit`)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors shadow-sm"
              >
                팀 정보 수정
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
            >
              목록으로
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 팀 정보 카드 */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-indigo-500" />팀
                정보
              </h3>

              <div className="space-y-5">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    설명
                  </dt>
                  <dd className="text-sm text-gray-900 bg-gray-50 p-3 rounded-xl leading-relaxed">
                    {team.description || "등록된 설명이 없습니다."}
                  </dd>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    <CheckCircleIcon className="h-4 w-4 text-gray-400" /> 상태
                  </dt>
                  <dd>
                    <span
                      className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        team.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {team.active ? "활성" : "비활성"}
                    </span>
                  </dd>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <dt className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />{" "}
                    생성일
                  </dt>
                  <dd className="text-sm text-gray-900 font-medium">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 멤버 리스트 카드 */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-indigo-500" />
                  소속 멤버
                  <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-xs ml-1">
                    {members.length}
                  </span>
                </h3>
                {canModify && (
                  <button
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-xs sm:text-sm font-medium transition-colors shadow-sm"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">멤버 추가</span>
                    <span className="sm:hidden">추가</span>
                  </button>
                )}
              </div>

              {members.length > 0 ? (
                <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="group hover:bg-gray-50 transition-colors"
                    >
                      <Link
                        to={`/admin/users/${member.id}`}
                        className="flex items-center p-4 sm:px-6"
                      >
                        <UserCircleIcon className="h-10 w-10 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {formatDisplayName(member, members)}
                            </p>
                            <span className="text-xs text-gray-400 group-hover:text-gray-500">
                              상세보기 &rarr;
                            </span>
                          </div>
                          {/* 직분이 있다면 여기에 추가 표시 가능 */}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-10 text-center">
                  <UserCircleIcon className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    소속된 멤버가 없습니다.
                  </p>
                  {canModify && (
                    <button
                      onClick={() => setIsAddMemberModalOpen(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      + 첫 번째 멤버를 추가해보세요
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetailPage;
