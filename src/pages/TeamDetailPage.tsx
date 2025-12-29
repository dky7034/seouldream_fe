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
          // Fetch all active members by setting a large size
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
      // Reset state when the modal is closed
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
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
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
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center p-4">
      {/* ✅ 작은 화면 대비: 전체 래퍼에 overflow-y-auto + min-h-screen */}
      <div className="w-full flex justify-center items-center">
        <div className="bg-white p-5 sm:p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <h2 className="text-lg sm:text-xl font-bold mb-4">팀에 멤버 추가</h2>

          {/* 검색창 */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="표시된 목록에서 이름으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* ✅ 리스트 영역: flex-1 + overflow-y-auto 로 모달 안에서만 스크롤 */}
          <div className="mb-4 flex-1 min-h-[120px] max-h-60 overflow-y-auto border rounded-md">
            {isLoading ? (
              <p className="p-4 text-sm text-gray-500">
                멤버 목록을 불러오는 중...
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">
                {potentialMembers.length === 0
                  ? "추가할 수 있는 멤버가 없습니다."
                  : "검색 결과가 없습니다."}
              </p>
            ) : (
              <ul>
                {filteredMembers.map((member) => (
                  <li
                    key={member.id}
                    className={`flex items-center text-sm hover:bg-indigo-50 ${
                      selectedMemberIds.has(member.id) ? "bg-indigo-100" : ""
                    }`}
                  >
                    <label
                      htmlFor={`member-checkbox-${member.id}`}
                      className="flex items-center w-full p-3 cursor-pointer"
                    >
                      <input
                        id={`member-checkbox-${member.id}`}
                        type="checkbox"
                        checked={selectedMemberIds.has(member.id)}
                        onChange={() => handleToggleMemberSelection(member.id)}
                        className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      {formatNameWithBirthdate(member)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm text-gray-600">
              {selectedMemberIds.size}명 선택됨
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-200 hover:bg-gray-300"
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
                disabled={selectedMemberIds.size === 0 || isSubmitting}
              >
                {isSubmitting ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // ── 팀 상세 조회 ─────────────────────────────
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
        message: "멤버가 추가되었습니다.",
      });
    } catch (error) {
      console.error("Failed to add members:", error);
      setAlertInfo({
        isOpen: true,
        title: "오류",
        message: "멤버 추가에 실패했습니다. 다시 시도해주세요.",
      });
    }
  };

  const closeAlert = () => {
    setAlertInfo({ isOpen: false, title: "", message: "" });
  };

  const canModify = user?.role === "EXECUTIVE";

  // ── 상태별 렌더링 ─────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
        <p className="text-lg text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto max-w-3xl px-3 sm:px-4 py-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto max-w-3xl px-3 sm:px-4 py-8 text-center">
          <p className="text-gray-600 mb-4">
            팀 정보를 찾을 수 없습니다. 삭제되었거나 권한이 없을 수 있습니다.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ── 메인 렌더링 ───────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
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
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 상단 헤더 + 액션 버튼 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {team.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              팀 기본 정보와 소속 멤버 목록을 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {canModify && (
              <button
                onClick={() => navigate(`/admin/teams/${team.id}/edit`)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-xs sm:text-sm"
              >
                수정
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-xs sm:text-sm"
            >
              목록으로 돌아가기
            </button>
          </div>
        </div>

        {/* 내용 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* 팀 정보 카드 */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                팀 정보
              </h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">설명</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {team.description || "등록된 설명이 없습니다."}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">상태</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        team.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {team.active ? "활성" : "비활성"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">생성일</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* 팀 멤버 카드 */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  소속 멤버 ({members.length}명)
                </h3>
                {canModify && (
                  <button
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-xs sm:text-sm"
                  >
                    인원 추가
                  </button>
                )}
              </div>
              {members.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="py-3 sm:py-3 flex items-center justify-between"
                    >
                      <Link
                        to={`/admin/users/${member.id}`}
                        className="text-sm sm:text-base text-indigo-600 hover:underline"
                      >
                        {formatDisplayName(member, members)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">소속된 멤버가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetailPage;
