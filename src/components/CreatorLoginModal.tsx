import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

interface CreatorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatorLoginModal: React.FC<CreatorLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { login } = useAdmin();
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Informe a senha de acesso.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await login(passcode);
    setLoading(false);

    if (res.success) {
      setPasscode('');
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Senha incorreta.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel-elevated p-6 md:p-8 border border-white/15 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading tracking-wide">
              Área Restrita • Modo Criador
            </h2>
            <p className="text-xs text-white/60 font-mono-code">
              Acesso exclusivo para administradores e produtores da Rádio AI
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-mono-code">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code uppercase tracking-wider text-purple-300 mb-1.5 font-semibold">
              Senha de Acesso / Creator Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Digite a senha de produtor..."
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm font-mono-code focus:outline-none focus:border-purple-400 transition-colors pl-10 pr-10"
              />
              <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm tracking-wide font-mono-code flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Desbloquear Ferramentas de Criador</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
