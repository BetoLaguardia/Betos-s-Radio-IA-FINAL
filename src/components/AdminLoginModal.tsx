import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { login } = useAdmin();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Informe a chave de acesso do administrador.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await login(password);
    setLoading(false);

    if (res.success) {
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Acesso negado.');
    }
  };

  const handleUseDefaultKey = () => {
    setPassword('P@drao283011');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel-elevated p-6 md:p-8 border border-white/15 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Icon & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/25 mb-3">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold font-heading tracking-wide">
            Área Restrita da Emissora
          </h2>
          <p className="text-xs text-white/60 font-mono-code mt-1 max-w-xs">
            Acesso interno para produção lírica no Gemini, download de áudio Suno e gestão de acervo.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-mono-code">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code uppercase tracking-wider text-amber-300 font-semibold mb-1.5">
              Chave Mestra do Painel Admin
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Digite a senha de administrador..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white placeholder-white/30 text-sm font-mono-code focus:outline-none focus:border-amber-400 transition-colors pl-10 pr-10"
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

          <div className="flex items-center justify-between text-[11px] font-mono-code text-white/50 pt-0.5">
            <span>Chave padrão do estúdio:</span>
            <button
              type="button"
              onClick={handleUseDefaultKey}
              className="text-amber-400 hover:text-amber-300 underline font-bold"
            >
              Preencher (P@drao283011)
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-bold text-xs tracking-wider uppercase font-mono-code flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Desbloquear Painel Interno</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-center text-white/40 font-mono-code mt-4">
          Usuários comuns têm acesso exclusivo à audição pública, letras e cast.
        </p>
      </div>
    </div>
  );
};
