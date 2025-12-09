import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { TeamDto, UpdateTeamRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import TeamForm from "../components/TeamForm"; // Import the new TeamForm component

const EditTeamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamDto | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") {
      setError("팀 정보를 수정할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    const fetchTeam = async () => {
      try {
        setLoading(true);
        if (id) {
          const teamData = await teamService.getTeamById(Number(id));
          setEditingTeam(teamData);
        }
      } catch (err) {
        setError("팀 정보를 불러오는 데 실패했습니다.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [id, user]);

  const handleSubmit = async (formData: UpdateTeamRequest) => {
    setLoading(true);
    setSubmitError(null);
    if (!editingTeam) {
      setSubmitError("수정할 팀 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      await teamService.updateTeam(editingTeam.id, formData);
      navigate("/admin/teams");
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || "팀 수정에 실패했습니다.");
      console.error("팀 수정 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="mt-4 text-gray-600">로딩 중...</p>;
  }

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  if (!editingTeam) {
    return <p className="mt-4 text-red-600">팀 정보를 찾을 수 없습니다.</p>;
  }

  // Pass the full team DTO as initialData.
  // The TeamForm component will handle the fields.
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
      loading={loading}
      submitError={submitError}
      isEditing={true}
    />
  );
};

export default EditTeamPage;
