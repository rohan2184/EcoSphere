import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

// Backend /auth/* is live — every route requires a login.
export const AUTH_ENFORCED = true;

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "employee";
  department_id: number | null;
  points_balance?: number;
  xp_balance?: number;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      api.get<User>("/auth/me").then((r) => setUser(r.data)).catch(() => logout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.access_token);
    setToken(data.access_token);
  }

  async function register(name: string, email: string, password: string) {
    await api.post("/auth/register", { name, email, password });
    await login(email, password);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
