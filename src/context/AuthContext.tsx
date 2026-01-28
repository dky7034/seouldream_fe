// src/context/AuthContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import authService from "../services/authService";
import type { User } from "../types";

export interface AuthContextType {
  user: User | null;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>; // ✅ rememberMe optional 추가
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 앱 부팅 시 최초 1회 인증 상태 확인
    const checkUser = () => {
      const storedUser = authService.getCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      }
      setLoading(false);
    };
    checkUser();

    // ✅ [추가] 다른 탭의 토큰 변경 사항을 감지하는 리스너
    const handleStorageChange = () => {
      console.log(
        "Auth storage updated by another tab. Re-checking auth state."
      );
      const updatedUser = authService.getCurrentUser();
      setUser(updatedUser);
    };

    window.addEventListener("auth-storage-updated", handleStorageChange);

    return () => {
      window.removeEventListener("auth-storage-updated", handleStorageChange);
    };
  }, []);

  const login = async (
    username: string,
    password: string,
    rememberMe: boolean = false
  ) => {
    const loggedInUser = await authService.login(
      username,
      password,
      rememberMe
    );
    setUser(loggedInUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isAuthenticated = !!user;

  if (loading) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};
