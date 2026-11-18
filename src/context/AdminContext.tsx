import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  adminToken: string | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AdminContext = createContext<AdminContextType | null>(null);

const STORAGE_KEY = 'radio_ai_admin_token';

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || null;
  });

  const isAdmin = Boolean(adminToken);

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setAdminToken(data.token);
        sessionStorage.setItem(STORAGE_KEY, data.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Senha incorreta.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const logout = () => {
    setAdminToken(null);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (!adminToken) return {};
    return {
      'x-admin-key': adminToken,
      Authorization: `Bearer ${adminToken}`,
    };
  };

  return (
    <AdminContext.Provider value={{ isAdmin, adminToken, login, logout, getAuthHeaders }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
