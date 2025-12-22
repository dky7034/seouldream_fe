// src/components/ExecOnlyRoute.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ExecOnlyRoute: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    // 비로그인 사용자는 로그인 페이지로
    return <Navigate to="/" replace />;
  }

  if (user.role !== "EXECUTIVE") {
    // 임원이 아니면 대시보드로 돌려보내기
    return <Navigate to="/dashboard" replace />;
  }

  // EXECUTIVE만 통과
  return <Outlet />;
};

export default ExecOnlyRoute;
