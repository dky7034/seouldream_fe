import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaBullhorn, FaPlus } from "react-icons/fa";
import { BookmarkIcon } from "@heroicons/react/24/solid";
import type {
  DashboardDto,
  RecentNoticeInfo,
  RecentPrayerInfo,
} from "../../types";

// --- 공용 Card 컴포넌트 (변경 없음) ---
interface CardProps {
  icon?: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  icon,
  title,
  actions,
  children,
  className = "",
}) => (
  <div
    className={`bg-white p-4 sm:p-6 rounded-2xl shadow-lg h-full flex flex-col ${className}`}
  >
    <div className="flex justify-between items-center mb-4 border-b pb-3">
      <div className="flex items-center min-w-0">
        {icon && (
          <div className="text-lg sm:text-xl text-gray-500 mr-3">{icon}</div>
        )}
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
          {title}
        </h3>
      </div>
      {actions && <div className="flex-shrink-0 ml-2">{actions}</div>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

// --- 메인 NewsCenterCard 컴포넌트 ---

interface NewsCenterCardProps {
  data: DashboardDto;
  canManageNotices: boolean;
  totalNotices: number;
  totalPrayers: number;
  baseRoute?: "admin" | "cell";
}

type NewsTab = "notices" | "prayers";

const MAX_NEWS_ITEMS = 5;

const NewsCenterCard: React.FC<NewsCenterCardProps> = ({
  data,
  canManageNotices,
  totalNotices,
  totalPrayers,
  baseRoute = "admin",
}) => {
  const [activeTab, setActiveTab] = useState<NewsTab>("notices");

  const isCellMode = baseRoute === "cell";
  const cardTitle = isCellMode ? "공지사항" : "공동체 소식";

  // ✅ [수정됨] 링크 경로 생성 로직
  const getLinkPath = (type: "notice" | "prayer", id?: number) => {
    if (type === "notice") {
      return id ? `/admin/notices/${id}` : `/admin/notices`;
    }

    if (type === "prayer") {
      if (baseRoute === "cell") {
        return `/my-cell`;
      } else {
        // id가 있으면(개별 항목) 상세 페이지로,
        // id가 없으면(더보기) 요청하신 '멤버별 요약 페이지'로 이동
        return id ? `/admin/prayers/${id}` : `/admin/prayers/summary/members`; // 👈 여기가 변경되었습니다.
      }
    }
    return "#";
  };

  const notices: RecentNoticeInfo[] = data.recentNotices;
  const prayers: RecentPrayerInfo[] = data.recentPrayers;

  const renderContent = () => {
    // 1. 공지사항 탭
    if (activeTab === "notices") {
      const items = notices.slice(0, MAX_NEWS_ITEMS);
      return notices.length > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.noticeId} className="py-2">
                <Link
                  to={getLinkPath("notice", n.noticeId)}
                  className="block hover:bg-gray-50 p-2 rounded-md group"
                >
                  <p className="font-medium text-gray-800 group-hover:text-indigo-600 flex items-center text-sm">
                    {n.pinned && (
                      <BookmarkIcon className="h-4 w-4 text-red-500 mr-1 flex-shrink-0" />
                    )}
                    <span className="truncate">{n.title}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {totalNotices > MAX_NEWS_ITEMS && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] sm:text-xs text-gray-400">
              <span>외 {totalNotices - MAX_NEWS_ITEMS}개 더 있습니다.</span>
              <Link
                to={getLinkPath("notice")}
                className="text-indigo-500 hover:text-indigo-700 font-medium"
              >
                전체 공지 보기
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-6 text-sm">
          아직 등록된 공지사항이 없습니다.
        </p>
      );
    }

    // 2. 기도제목 탭
    if (activeTab === "prayers") {
      const items = prayers.slice(0, MAX_NEWS_ITEMS);
      return prayers.length > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-gray-100">
            {items.map((p) => (
              <li key={p.prayerId} className="py-2">
                <Link
                  to={getLinkPath("prayer", p.prayerId)}
                  className={`block hover:bg-gray-50 p-2 rounded-md group ${
                    baseRoute === "cell"
                      ? "pointer-events-none cursor-default"
                      : ""
                  }`}
                >
                  <p className="font-medium text-gray-800 truncate group-hover:text-indigo-600 text-sm">
                    {p.content}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {p.memberName} |{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {/* 기도제목 더보기 링크 */}
          {totalPrayers > MAX_NEWS_ITEMS && baseRoute !== "cell" && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] sm:text-xs text-gray-400">
              <span>외 {totalPrayers - MAX_NEWS_ITEMS}개 더 있습니다.</span>
              <Link
                to={getLinkPath("prayer")} // id 없이 호출 -> 위에서 설정한 경로로 이동
                className="text-indigo-500 hover:text-indigo-700 font-medium"
              >
                전체 기도제목 보기
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-6 text-sm">
          최근 등록된 기도제목이 없습니다.
        </p>
      );
    }

    return null;
  };

  return (
    <Card
      icon={<FaBullhorn className="text-yellow-500" />}
      title={cardTitle}
      actions={
        activeTab === "notices" && canManageNotices ? (
          <Link
            to="/admin/notices/add"
            className="inline-flex items-center text-[11px] sm:text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <FaPlus className="mr-1" /> 공지 등록
          </Link>
        ) : null
      }
    >
      {!isCellMode && (
        <div className="mb-4">
          <div className="inline-flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("notices")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                activeTab === "notices"
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              공지사항
            </button>
            <button
              onClick={() => setActiveTab("prayers")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                activeTab === "prayers"
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              기도제목
            </button>
          </div>
        </div>
      )}

      {renderContent()}
    </Card>
  );
};

export default NewsCenterCard;
