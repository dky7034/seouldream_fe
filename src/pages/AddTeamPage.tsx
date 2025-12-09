import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { CreateTeamRequest, UpdateTeamRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import TeamForm from "../components/TeamForm"; // Import the new TeamForm component

type TeamFormData = CreateTeamRequest | UpdateTeamRequest;

const AddTeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect if not EXECUTIVE
  if (!user || user.role !== "EXECUTIVE") {
    navigate("/admin/teams"); // Redirect to teams list if not authorized
    return null;
  }

  const handleSubmit = async (formData: TeamFormData) => {
    setLoading(true);
    setSubmitError(null);
    try {
      if (formData.name) {
        await teamService.createTeam(formData as CreateTeamRequest);
        navigate("/admin/teams"); // Go back to team list
      } else {
        setSubmitError("팀 이름은 필수입니다.");
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || "팀 생성에 실패했습니다.");
      console.error("팀 생성 오류:", err);
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
    />
  );
};

export default AddTeamPage;
