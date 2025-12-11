import React, { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import CellAttendanceManager from "../components/CellAttendanceManager";
import CellPrayersManager from "../components/CellPrayersManager";
import CellMembersManager from "../components/CellMembersManager";
import {
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

type Tab = "attendance" | "prayers" | "members";

const isValidTab = (value: string | null): value is Tab => {
  return value === "attendance" || value === "prayers" || value === "members";
};

const MyCellPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: Tab = isValidTab(tabParam) ? tabParam : "attendance";

  const setActiveTab = (tab: Tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // 잘못된 tab 쿼리가 들어왔을 때 URL을 정리 (한 번만 실행되도록 조건 유지)
  useEffect(() => {
    if (!isValidTab(tabParam)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "attendance");
        return next;
      });
    }
  }, [tabParam, setSearchParams]);

  // 셀장이 아니거나 로그인되지 않은 경우 메인으로 리다이렉트
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
        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 focus:outline-none`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* 헤더 영역 */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          내 셀 관리
        </h1>
        {user.cellName && (
          <p className="mt-1 text-lg text-gray-800 font-semibold">
            {user.cellName}
          </p>
        )}
        <p className="mt-2 text-sm text-gray-600">
          셀 출석, 기도제목, 셀원 정보를 한 곳에서 관리할 수 있습니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-8"
          aria-label="내 셀 관리 탭"
          role="tablist"
        >
          {renderTabButton(
            "attendance",
            "출석 관리",
            CalendarDaysIcon,
            "tab-attendance",
            "panel-attendance"
          )}
          {renderTabButton(
            "prayers",
            "기도제목 관리",
            ChatBubbleBottomCenterTextIcon,
            "tab-prayers",
            "panel-prayers"
          )}
          {renderTabButton(
            "members",
            "셀원 관리",
            UsersIcon,
            "tab-members",
            "panel-members"
          )}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="mt-8">
        {activeTab === "attendance" && (
          <div
            id="panel-attendance"
            role="tabpanel"
            aria-labelledby="tab-attendance"
          >
            <CellAttendanceManager user={user} />
          </div>
        )}
        {activeTab === "prayers" && (
          <div id="panel-prayers" role="tabpanel" aria-labelledby="tab-prayers">
            <CellPrayersManager user={user} />
          </div>
        )}
        {activeTab === "members" && (
          <div id="panel-members" role="tabpanel" aria-labelledby="tab-members">
            <CellMembersManager user={user} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCellPage;
