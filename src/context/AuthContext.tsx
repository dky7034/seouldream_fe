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
    const checkUser = () => {
      const storedUser = authService.getCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      }
      setLoading(false);
    };
    checkUser();
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
