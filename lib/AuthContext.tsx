"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { logout as apiLogout, getUserInfo } from "@/lib/auth";
import { IUser } from "@/lib/type";

type AuthContextValue = {
  isAuthenticated: boolean;
  user: IUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string | null, refresh: string | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<IUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const storedAccess = localStorage.getItem("accessToken");
    const storedRefresh = localStorage.getItem("refreshToken");
    
    if (storedAccess && storedRefresh) {
      setAccessToken(storedAccess);
      setRefreshToken(storedRefresh);
    }
  }, []);

  const setTokens = (access: string | null, refresh: string | null) => {
    setAccessToken(access);
    setRefreshToken(refresh);
    
    if (typeof window !== "undefined") {
      if (access) {
        localStorage.setItem("accessToken", access);
      } else {
        localStorage.removeItem("accessToken");
      }
      
      if (refresh) {
        localStorage.setItem("refreshToken", refresh);
      } else {
        localStorage.removeItem("refreshToken");
      }
    }
  };

  const refreshUser = async () => {
    try {
      if (!accessToken) {
        setUser(null);
        return;
      }
      
      const userInfo = await getUserInfo();
      setUser(userInfo);
    } catch (error) {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [accessToken]);

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setTokens(null, null);
      setUser(null);
    }
  };

  const authData: AuthContextValue = {
    isAuthenticated: Boolean(accessToken),
    user: user,
    accessToken: accessToken,
    refreshToken: refreshToken,
    setTokens: setTokens,
    logout: logout,
    refreshUser: refreshUser,
  };

  return (
    <AuthContext.Provider value={authData}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
};


