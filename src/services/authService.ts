import axios, { type AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import api from "./api";
import type {
  CreateMemberRequest,
  JwtPayload,
  User,
  ChangePasswordRequest,
  JwtAuthenticationResponse,
  UserRole,
} from "../types";

// PROD/DEV 환경 분기
const API_BASE_URL = import.meta.env.PROD
  ? "https://nextdream.store/api"
  : "/api";

// 리프레시 토큰용 별도 인스턴스 (인터셉터 무한 루프 방지)
const refreshAxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// ✅ [추가] 탭 간 토큰 동기화를 위한 Broadcast Channel
const tokenChannel = new BroadcastChannel("token_channel");

// ✅ [추가] 다른 탭으로부터 토큰 업데이트 메시지 수신
tokenChannel.onmessage = (event) => {
  if (event.data?.type === "TOKENS_UPDATED") {
    const { accessToken, refreshToken, user } = event.data.payload;
    if (accessToken && refreshToken && user) {
      // 현재 탭의 스토리지를 다른 탭의 최신 정보와 동기화
      const rememberMe = !!localStorage.getItem("accessToken");
      _setTokens(accessToken, refreshToken, user, rememberMe);

      // React Context에 변경 사항을 알려 UI를 업데이트하도록 함
      window.dispatchEvent(new CustomEvent("auth-storage-updated"));
    }
  }
};

// ----------------------------------------------------
// Storage Helpers
// ----------------------------------------------------

const _setTokens = (
  accessToken: string,
  refreshToken: string,
  user: User,
  rememberMe: boolean
) => {
  const targetStorage = rememberMe ? localStorage : sessionStorage;
  const otherStorage = rememberMe ? sessionStorage : localStorage;

  targetStorage.setItem("accessToken", accessToken);
  targetStorage.setItem("refreshToken", refreshToken);
  targetStorage.setItem("user", JSON.stringify(user));

  otherStorage.removeItem("accessToken");
  otherStorage.removeItem("refreshToken");
  otherStorage.removeItem("user");
};

const _getTokens = (): {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
} => {
  let accessToken = sessionStorage.getItem("accessToken");
  let refreshToken = sessionStorage.getItem("refreshToken");
  let userStr = sessionStorage.getItem("user");

  if (!accessToken || !refreshToken || !userStr) {
    accessToken = localStorage.getItem("accessToken");
    refreshToken = localStorage.getItem("refreshToken");
    userStr = localStorage.getItem("user");
  }

  if (!accessToken || !refreshToken || !userStr) {
    return { accessToken: null, refreshToken: null, user: null };
  }

  let user: User | null = null;
  try {
    user = JSON.parse(userStr) as User;
  } catch (e) {
    console.error(
      "Failed to parse user data from storage. The data might be corrupt. Treating as logged out for this session.",
      e
    );
    // 파싱 실패 시 모든 토큰을 지우면 디버깅이 불가능해지므로,
    // 현재 세션만 로그아웃 처리하고 토큰은 유지시킨다.
    return { accessToken: null, refreshToken: null, user: null };
  }

  return { accessToken, refreshToken, user };
};

const _clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("user");
};

// ----------------------------------------------------
// Auth Service
// ----------------------------------------------------

const authService = {
  checkUsername: async (username: string): Promise<boolean> => {
    const response = await axios.get(`${API_BASE_URL}/auth/check-username`, {
      params: { username },
    });
    return response.data.isAvailable;
  },

  register: async (memberData: CreateMemberRequest) => {
    const response = await axios.post(`${API_BASE_URL}/members`, memberData);
    return response.data;
  },

  login: async (
    username: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<User> => {
    try {
      // ✅ [변경 1] 백엔드에 rememberMe 값 전달 (30일 토큰 발급 요청)
      const response: AxiosResponse<JwtAuthenticationResponse> =
        await axios.post(`${API_BASE_URL}/auth/login`, {
          username,
          password,
          rememberMe, // 추가됨
        });

      const {
        accessToken,
        refreshToken,
        userId,
        memberId,
        role: responseRole,
        name,
        cellId,
        cellName,
      } = response.data;

      if (!accessToken || !refreshToken) {
        throw new Error("Login failed: Tokens not received");
      }

      const decodedToken = jwtDecode<JwtPayload>(accessToken);
      const allowedRoles: UserRole[] = ["EXECUTIVE", "CELL_LEADER", "MEMBER"];
      const normalizedRole: UserRole = allowedRoles.includes(
        responseRole as UserRole
      )
        ? (responseRole as UserRole)
        : "MEMBER";

      const user: User = {
        id: userId,
        memberId: memberId,
        username: decodedToken.sub,
        name: name,
        role: normalizedRole,
        cellId: cellId,
        cellName: cellName,
      };

      _setTokens(accessToken, refreshToken, user, rememberMe);

      // ✅ [추가] 다른 탭에 토큰 업데이트 전파
      tokenChannel.postMessage({
        type: "TOKENS_UPDATED",
        payload: { accessToken, refreshToken, user },
      });

      return user;
    } catch (error: any) {
      console.error("Login error:", error.response?.data || error.message);
      throw error;
    }
  },

  logout: async () => {
    const token = authService.getAccessToken();
    if (token) {
      try {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error("Logout API failed");
      }
    }
    _clearTokens();
  },

  refreshToken: async (): Promise<string | null> => {
    let refreshToken = sessionStorage.getItem("refreshToken");
    let targetStorage = sessionStorage;

    if (!refreshToken) {
      refreshToken = localStorage.getItem("refreshToken");
      targetStorage = localStorage;
    }

    if (!refreshToken) return null;

    try {
      const response = await refreshAxiosInstance.post("/auth/refresh", {
        refreshToken,
      });

      // ✅ [변경 2] Access Token 뿐만 아니라 Refresh Token도 받아서 갱신 (Rotation)
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        response.data;

      if (newAccessToken && newRefreshToken) {
        const user = authService.getCurrentUser(); // 최신 유저 정보 가져오기

        targetStorage.setItem("accessToken", newAccessToken);
        targetStorage.setItem("refreshToken", newRefreshToken); // Refresh Token 교체

        // ✅ [추가] 다른 탭에 토큰 업데이트 전파
        tokenChannel.postMessage({
          type: "TOKENS_UPDATED",
          payload: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user,
          },
        });

        return newAccessToken;
      }

      return null;
    } catch (error) {
      console.error("Refresh failed", error);
      authService.logout();
      return null;
    }
  },

  getCurrentUser: (): User | null => {
    const { user } = _getTokens();
    return user;
  },

  getAccessToken: () => {
    const { accessToken } = _getTokens();
    return accessToken;
  },

  getRefreshToken: () => {
    const { refreshToken } = _getTokens();
    return refreshToken;
  },

  changePassword: async (
    userId: number,
    data: ChangePasswordRequest
  ): Promise<void> => {
    await api.post(`/auth/change-password/${userId}`, data);
  },
};

export default authService;
