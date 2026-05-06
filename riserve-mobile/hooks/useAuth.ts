import { useState, useEffect, createContext, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as apiLogin, myProfile } from "../services/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  staff?: { id: string; department: string; employment_type: string; skills: string[] } | null;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

import { createContext as rCreateContext } from "react";
export const AuthContext = rCreateContext<AuthCtx>({
  user: null, token: null, loading: true,
  login: async () => {}, logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthCtx {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("token");
        if (stored) {
          setToken(stored);
          const res = await myProfile();
          setUser(res.data);
        }
      } catch {
        await AsyncStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    const { access_token } = res.data;
    await AsyncStorage.setItem("token", access_token);
    setToken(access_token);
    const profile = await myProfile();
    setUser(profile.data);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return { user, token, loading, login, logout };
}
