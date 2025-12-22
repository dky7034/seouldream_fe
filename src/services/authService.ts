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

// ✅ 환경에 따라 주소가 자동으로 바뀝니다!
// PROD(배포상태)일 땐 "https://nextdream.store/api" 사용
// DEV(개발상태)일 땐 "/api" (Vite의 Proxy 설정을 타서 localhost:8080으로 연결됨)
const API_BASE_URL = import.meta.env.PROD
  ? "https://nextdream.store/api"
  : "/api";

// Use a separate axios instance for refresh to avoid interceptor loops
const refreshAxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// Helper functions for storage abstraction
const _setTokens = (
  accessToken: string,
  refreshToken: string,
  user: User,
  rememberMe: boolean
) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("accessToken", accessToken);
  storage.setItem("refreshToken", refreshToken);
  storage.setItem("user", JSON.stringify(user));

  // Clear from other storage if present
  const otherStorage = rememberMe ? sessionStorage : localStorage;
  otherStorage.removeItem("accessToken");
  otherStorage.removeItem("refreshToken");
  otherStorage.removeItem("user");
};

const _getTokens = (): {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
} => {
  let accessToken = localStorage.getItem("accessToken");
  let refreshToken = localStorage.getItem("refreshToken");
  let userStr = localStorage.getItem("user");

  if (!accessToken || !refreshToken || !userStr) {
    accessToken = sessionStorage.getItem("accessToken");
    refreshToken = sessionStorage.getItem("refreshToken");
    userStr = sessionStorage.getItem("user");
  }

  let user: User | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr) as User;
    } catch (e) {
      console.error("Failed to parse user from storage", e);
      _clearTokens(); // Clear invalid data
    }
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

const authService = {
  checkUsername: async (username: string): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/check-username`, {
        params: { username },
      });
      return response.data.isAvailable;
    } catch (error: any) {
      console.error(
        "Username check error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  register: async (memberData: CreateMemberRequest) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/members`, memberData);
      return response.data;
    } catch (error: any) {
      console.error(
        "Registration error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  login: async (
    username: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<User> => {
    try {
      const response: AxiosResponse<JwtAuthenticationResponse> =
        await axios.post(`${API_BASE_URL}/auth/login`, {
          username,
          password,
        });

      const {
        accessToken,
        refreshToken,
        userId,
        memberId,
        role: responseRole, // ← 이름 살짝 바꿔줌
        name,
        cellId,
        cellName,
      } = response.data;

      if (!accessToken || !refreshToken) {
        throw new Error("Login failed: Tokens not received");
      }

      const decodedToken = jwtDecode<JwtPayload>(accessToken);

      // ✅ 백엔드에서 온 문자열 role을 UserRole로 안전하게 변환
      const allowedRoles: UserRole[] = ["EXECUTIVE", "CELL_LEADER", "MEMBER"];

      const normalizedRole: UserRole = allowedRoles.includes(
        responseRole as UserRole
      )
        ? (responseRole as UserRole)
        : "MEMBER"; // 혹시 이상한 값 오면 기본값을 MEMBER로

      const user: User = {
        id: userId,
        memberId: memberId,
        username: decodedToken.sub,
        name: name,
        role: normalizedRole, // ✅ 이제 UserRole
        cellId: cellId,
        cellName: cellName,
      };

      _setTokens(accessToken, refreshToken, user, rememberMe);
      return user;
    } catch (error: any) {
      console.error("Login error:", error.response?.data || error.message);
      throw error;
    }
  },

  logout: async () => {
    const token = authService.getAccessToken(); // Use getAccessToken to retrieve token correctly
    if (token) {
      try {
        await axios.post(
          `${API_BASE_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (error: any) {
        console.error(
          "Logout API call failed:",
          error.response?.data || error.message
        );
      }
    }
    _clearTokens();
  },

  refreshToken: async (): Promise<string | null> => {
    const { refreshToken } = _getTokens(); // Use _getTokens
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshAxiosInstance.post("/auth/refresh", {
        refreshToken,
      });
      const { accessToken } = response.data;

      if (accessToken) {
        // When refreshing token, assume the previous 'rememberMe' state
        // and re-save tokens with the same preference.
        // We need to re-fetch the user object to pass to _setTokens
        const { user } = _getTokens();
        const rememberMe = localStorage.getItem("accessToken") !== null; // Check if it was saved in local storage
        if (user) {
          _setTokens(accessToken, refreshToken, user, rememberMe);
        } else {
          // This case should ideally not happen if user is properly stored
          localStorage.setItem("accessToken", accessToken); // Fallback to localStorage if user is missing
        }
        return accessToken;
      }
      return null;
    } catch (error) {
      console.error("Failed to refresh token", error);
      // If refresh fails, log the user out
      authService.logout();
      return null;
    }
  },

  getCurrentUser: (): User | null => {
    const { user } = _getTokens(); // Use _getTokens
    return user;
  },

  changePassword: async (
    userId: number,
    data: ChangePasswordRequest
  ): Promise<void> => {
    try {
      // 이미 위에서 import한 api 사용
      await api.post(`/auth/change-password/${userId}`, data);
    } catch (error: any) {
      console.error(
        "Password change error:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  getAccessToken: () => {
    const { accessToken } = _getTokens(); // Use _getTokens
    return accessToken;
  },

  getRefreshToken: () => {
    const { refreshToken } = _getTokens(); // Use _getTokens
    return refreshToken;
  },
};

export default authService;
