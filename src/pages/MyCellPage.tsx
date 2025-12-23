// src/pages/MyCellPage.tsx
import React, { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { memberService } from "../services/memberService"; // [추가]
import CellAttendanceManager from "../components/CellAttendanceManager";
import CellPrayersManager from "../components/CellPrayersManager";
import CellMembersManager from "../components/CellMembersManager";
import {
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

type Tab = "attendance" | "prayers" | "members";

const isValidTab = (value: string | null): value is Tab =>
  value === "attendance" || value === "prayers" || value === "members";

const MyCellPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // [추가] 동명이인 판별을 위한 전체 멤버 리스트 (자식 컴포넌트에 전달용)
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  /** ✅ 셀 배정 여부: cellId 기준 */
  const hasCell = user?.role === "CELL_LEADER" && user.cellId != null;

  const tabParam = searchParams.get("tab");
  const activeTab: Tab = isValidTab(tabParam) ? tabParam : "attendance";

  const setActiveTab = (tab: Tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // [추가] 전체 멤버 목록 로딩 (한 번만 수행하여 자식들에게 공유)
  useEffect(() => {
    if (!user) return;
    const fetchAllMembers = async () => {
      try {
        const res = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });
        setAllMembersForNameCheck(
          res.content.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          }))
        );
      } catch (e) {
        console.error("동명이인 목록 로딩 실패:", e);
      }
    };
    fetchAllMembers();
  }, [user]);

  // 잘못된 tab 쿼리 정리
  useEffect(() => {
    if (!isValidTab(tabParam)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "attendance");
        return next;
      });
    }
  }, [tabParam, setSearchParams]);

  // 셀장이 아니거나 로그인되지 않은 경우
  if (!user || user.role !== "CELL_LEADER") {
    return <Navigate to="/" replace />;
  }

  const renderTabButton = (
    tab: Tab,
    label: string,
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>,
    buttonId: string,
    panelId: string
  ) => {
    const isActive = activeTab === tab;

    return (
      <button
        type="button"
        id={buttonId}
        onClick={() => setActiveTab(tab)}
        role="tab"
        aria-selected={isActive}
        aria-controls={panelId}
        className={`${
          isActive
            ? "border-indigo-500 text-indigo-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* ✅ 헤더 영역 */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            내 셀 관리
          </h1>

          {hasCell ? (
            <p className="mt-1 text-base sm:text-lg text-gray-800 font-semibold">
              {user.cellName ?? "내 셀"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              아직 셀에 배정되지 않았습니다. 관리자에게 문의하세요.
            </p>
          )}

          <p className="mt-2 text-sm sm:text-base text-gray-600">
            셀 출석, 기도제목, 셀원 정보를 한 곳에서 관리할 수 있습니다.
          </p>
        </div>

        {/* ✅ 탭 네비게이션 수정 */}
        <div className="border-b border-gray-200">
          <nav
            className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto"
            role="tablist"
            aria-label="내 셀 관리 탭"
          >
            {/* 1. 출석 관리 -> 셀 보고서 (작성) */}
            {renderTabButton(
              "attendance",
              "셀 보고서", // ✨ 변경: 포괄적인 입력 업무임을 명시
              CalendarDaysIcon,
              "tab-attendance",
              "panel-attendance"
            )}

            {/* 2. 기도제목 관리 -> 기도제목 목록 */}
            {renderTabButton(
              "prayers",
              "기도제목 목록", // ✨ 변경: 조회가 주 목적임을 명시
              ChatBubbleBottomCenterTextIcon,
              "tab-prayers",
              "panel-prayers"
            )}

            {/* 3. 셀원 관리 -> 셀원 정보 */}
            {renderTabButton(
              "members",
              "셀원 정보", // ✨ 변경: 정보 확인용임을 명시
              UsersIcon,
              "tab-members",
              "panel-members"
            )}
          </nav>
        </div>

        {/* ✅ 탭 컨텐츠 (각 컴포넌트에 allMembers 전달) */}
        <div className="mt-6 sm:mt-8">
          {activeTab === "attendance" && (
            <div
              id="panel-attendance"
              role="tabpanel"
              aria-labelledby="tab-attendance"
              className="bg-white shadow-sm rounded-lg p-3 sm:p-4"
            >
              {/* @ts-ignore: 자식 컴포넌트 prop 수정 전 임시 처리 */}
              <CellAttendanceManager
                user={user}
                allMembers={allMembersForNameCheck}
              />
            </div>
          )}

          {activeTab === "prayers" && (
            <div
              id="panel-prayers"
              role="tabpanel"
              aria-labelledby="tab-prayers"
              className="bg-white shadow-sm rounded-lg p-3 sm:p-4"
            >
              {/* @ts-ignore: 자식 컴포넌트 prop 수정 전 임시 처리 */}
              <CellPrayersManager
                user={user}
                allMembers={allMembersForNameCheck}
              />
            </div>
          )}

          {activeTab === "members" && (
            <div
              id="panel-members"
              role="tabpanel"
              aria-labelledby="tab-members"
              className="bg-white shadow-sm rounded-lg p-3 sm:p-4"
            >
              {/* @ts-ignore: 자식 컴포넌트 prop 수정 전 임시 처리 */}
              <CellMembersManager
                user={user}
                allMembers={allMembersForNameCheck}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyCellPage;
