// src/pages/AddTeamPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { CreateTeamRequest, UpdateTeamRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import TeamForm from "../components/TeamForm";

// TeamForm이 넘겨줄 값에 memberIds를 추가로 포함
type TeamFormValues = (CreateTeamRequest | UpdateTeamRequest) & {
  memberIds?: number[];
};

const AddTeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ✅ 권한 체크는 useEffect 안에서 처리 (렌더 중 navigate 호출 방지)
  useEffect(() => {
    if (!user) return; // 아직 유저 로딩 중일 수 있음

    if (user.role !== "EXECUTIVE") {
      navigate("/admin/teams");
    }
  }, [user, navigate]);

  // ✅ user 정보가 아직 없는 동안: 카드형 로딩 UI
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          멤버 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  // ✅ EXECUTIVE가 아닌 경우: 안내 메시지
  if (user.role !== "EXECUTIVE") {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          팀 생성 권한이 없습니다. 목록 페이지로 이동합니다.
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: TeamFormValues) => {
    setLoading(true);
    setSubmitError(null);

    try {
      // 1) 팀 기본 정보 생성
      const payload: CreateTeamRequest = {
        name: formData.name?.trim() ?? "",
        description: formData.description?.trim() || undefined,
        active: formData.active ?? true,
      };

      const newTeam = await teamService.createTeam(payload);

      // 2) 선택된 멤버가 있다면, 이 팀에 소속 관계 추가
      if (formData.memberIds && formData.memberIds.length > 0) {
        // 팀은 중복 소속 허용이므로, 이 팀에만 추가하면 됨
        await teamService.addMembersToTeam(newTeam.id, formData.memberIds);
      }

      navigate("/admin/teams");
    } catch (err: any) {
      console.error("팀 생성 오류:", err);
      setSubmitError(err.response?.data?.message || "팀 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeamForm
      onSubmit={handleSubmit}
      loading={loading}
      submitError={submitError}
      isEditing={false}
      // 필요 시 초기값 확장 가능
      // initialData={{ name: "", description: "", active: true, memberIds: [] }}
    />
  );
};

export default AddTeamPage;
