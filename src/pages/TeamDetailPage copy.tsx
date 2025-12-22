import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { TeamDto, MemberDto } from "../types";
import { useAuth } from "../hooks/useAuth";

const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-600 mb-4">
          팀 정보를 찾을 수 없습니다. 삭제되었거나 권한이 없을 수 있습니다.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  // ── 메인 렌더링 ───────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* 상단 헤더 + 액션 버튼 */}
        <div className="flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
            <p className="mt-2 text-sm text-gray-600">
              팀 기본 정보와 소속 멤버 목록을 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-shrink-0 space-x-2">
            {canModify && (
              <button
                onClick={() => navigate(`/admin/teams/${team.id}/edit`)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
              >
                수정
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
            >
              목록으로 돌아가기
            </button>
          </div>
        </div>

        {/* 내용 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 팀 정보 카드 */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                팀 정보
              </h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">설명</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {team.description || "N/A"}
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
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                소속 멤버 ({members.length}명)
              </h3>
              {members.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {members.map((member) => (
                    <li key={member.id} className="py-2">
                      <Link
                        to={`/admin/users/${member.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {member.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">소속된 멤버가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamDetailPage;
