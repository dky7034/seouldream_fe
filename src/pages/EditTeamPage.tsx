import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { TeamDto, UpdateTeamRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import TeamForm from "../components/TeamForm";

const EditTeamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamDto | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // user 로딩 중이면 일단 대기
    if (!user) return;

    const fetchTeam = async () => {
      // 권한 체크
      if (user.role !== "EXECUTIVE") {
        setError("팀 정보를 수정할 권한이 없습니다.");
        setIsFetching(false);
        return;
      }

      // ID 유효성 체크
      if (!id) {
        setError("유효하지 않은 팀 ID 입니다.");
        setIsFetching(false);
        return;
      }

      const teamId = Number(id);
      if (Number.isNaN(teamId)) {
        setError("유효하지 않은 팀 ID 입니다.");
        setIsFetching(false);
        return;
      }

      try {
        setIsFetching(true);
        const teamData = await teamService.getTeamById(teamId);
        setEditingTeam(teamData);
      } catch (err) {
        console.error(err);
        setError("팀 정보를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchTeam();
  }, [id, user]);

  const handleSubmit = async (formData: UpdateTeamRequest) => {
    if (!editingTeam) {
      setSubmitError("수정할 팀 정보를 찾을 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await teamService.updateTeam(editingTeam.id, formData);
      navigate("/admin/teams");
    } catch (err: any) {
      console.error("팀 수정 오류:", err);
      setSubmitError(err?.response?.data?.message || "팀 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // auth 로딩 중
  if (!user) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  if (isFetching) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  if (!editingTeam) {
    return <p className="mt-4 text-red-600">팀 정보를 찾을 수 없습니다.</p>;
  }

  const initialFormData: UpdateTeamRequest = {
    name: editingTeam.name,
    code: editingTeam.code,
    description: editingTeam.description,
    active: editingTeam.active,
  };

  return (
    <TeamForm
      initialData={initialFormData}
      onSubmit={handleSubmit}
      loading={isSubmitting}
      submitError={submitError}
      isEditing={true}
    />
  );
};

export default EditTeamPage;
