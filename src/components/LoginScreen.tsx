import React, { useState } from 'react';
import { LogIn, AlertTriangle, ShieldCheck, User, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, senha: string) => Promise<void>;
  onCheckZempo: (zempo: string) => Promise<any>;
  onFirstAccess: (zempo: string, email: string, senha: string, telefone: string, userData: any, role: string) => Promise<void>;
  onOnboarding: (nomeOrganizacao: string, nomeAdmin: string, emailAdmin: string, senhaAdmin: string) => Promise<void>;
  loginError: string;
  isLoading?: boolean;
}

export function LoginScreen({ onLogin, onCheckZempo, onFirstAccess, onOnboarding, loginError, isLoading }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'check_zempo' | 'complete_signup' | 'onboarding'>('login');
  
  // Login state
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  
  // First access state
  const [zempo, setZempo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [userRole, setUserRole] = useState('');
  const [localError, setLocalError] = useState('');

  // Onboarding state
  const [nomeOrganizacao, setNomeOrganizacao] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, senha);
  };

  const handleCheckZempoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!zempo.trim()) {
      setLocalError('Por favor, informe seu número ZEMPO.');
      return;
    }
    
    const result = await onCheckZempo(zempo.trim());
    if (result) {
      setUserData(result.user);
      setUserRole(result.role);
      setMode('complete_signup');
    } else {
      setLocalError('Número ZEMPO não encontrado. Solicite o cadastro ao seu Coordenador.');
    }
  };

  const handleCompleteSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim() || !telefone.trim()) {
      setLocalError('Por favor, preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    onFirstAccess(zempo.trim(), email, senha, telefone, userData, userRole);
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeOrganizacao.trim() || !nomeAdmin.trim() || !email.trim() || !senha.trim()) {
      setLocalError('Por favor, preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    onOnboarding(nomeOrganizacao.trim(), nomeAdmin.trim(), email.trim(), senha);
  };

  const displayError = localError || loginError;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-red-800 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?q=80&w=2049&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/90 to-red-800/90"></div>
        
        <div className="relative z-10 p-12 flex flex-col items-center text-center text-white max-w-lg">
          <div className="flex flex-col items-center gap-2 mb-10">
            <img src="/judo_tech_icon.png" alt="Logo" className="w-[160px] h-[160px] object-contain brightness-0 invert drop-shadow-2xl" />
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight drop-shadow-md">
                Sensei Assistente <span className="text-red-200 font-normal">Digital</span>
              </h1>
              <p className="text-red-100 text-lg mt-1 drop-shadow-md">A evolução natural do seu dojo</p>
            </div>
          </div>
          
          <p className="text-red-100 text-lg leading-relaxed mt-4">
            Sistema integrado para gestão de exames de graduação, katas, avaliações práticas e teóricas para academias, clubes e federações de judô.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6 w-full">
            <div className="bg-red-900/50 p-4 rounded-xl backdrop-blur-sm border border-red-700/50 flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-red-300 mb-2" />
              <span className="font-medium text-sm">Ambiente Seguro</span>
            </div>
            <div className="bg-red-900/50 p-4 rounded-xl backdrop-blur-sm border border-red-700/50 flex flex-col items-center">
              <User className="w-8 h-8 text-red-300 mb-2" />
              <span className="font-medium text-sm">Acesso Unificado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          <div className="flex flex-col items-center mb-6 lg:mb-10 mt-4 lg:mt-0 lg:hidden">
            <img src="/judo_tech_icon.png" alt="Logo" className="w-[80px] h-[80px] lg:w-[120px] lg:h-[120px] object-contain mb-2 lg:mb-4" />
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 text-center">
              Sensei Assistente
            </h1>
            <h2 className="text-xl lg:text-2xl font-normal text-red-700 text-center mb-1 lg:mb-2">
              Digital
            </h2>
            <p className="text-slate-500 text-xs lg:text-sm text-center">A evolução natural do seu dojo</p>
          </div>

          {mode === 'login' && (
            <>
              <div className="mb-6 lg:mb-8">
                <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1 lg:mb-2">
                  Bem-vindo de volta
                </h2>
                <p className="text-slate-500 text-sm lg:text-base">
                  Acesse sua conta com seu e-mail e senha.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4 lg:space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="Digite seu e-mail"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 lg:mb-2">
                    <label className="block text-sm font-semibold text-slate-700">Senha</label>
                    <button 
                      type="button" 
                      onClick={() => alert('Para redefinir sua senha, por favor entre em contato com a administração.')}
                      className="text-xs lg:text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="Digite sua senha"
                      required
                    />
                  </div>
                </div>

                {displayError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 lg:p-4 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-red-700 hover:bg-red-800 text-white p-3 lg:p-4 rounded-xl font-bold text-base lg:text-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" /> Entrar no Sistema
                    </>
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-center flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('check_zempo');
                    setLocalError('');
                  }}
                  className="text-sm font-medium text-slate-600 hover:text-red-700 transition-colors"
                >
                  Primeiro Acesso / Ativar Conta
                </button>
                <div className="border-t border-slate-200 w-full my-2"></div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('onboarding');
                    setLocalError('');
                    setEmail('');
                    setSenha('');
                  }}
                  className="text-sm font-bold text-red-700 hover:text-red-800 transition-colors"
                >
                  Nova Federação/Clube? Crie sua conta
                </button>
              </div>
            </>
          )}

          {mode === 'onboarding' && (
            <>
              <div className="mb-6 lg:mb-8">
                <button 
                  onClick={() => setMode('login')}
                  className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o login
                </button>
                <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1 lg:mb-2">
                  Criar Nova Conta
                </h2>
                <p className="text-slate-500 text-sm lg:text-base">
                  Cadastre sua Federação ou Clube para começar a usar o sistema.
                </p>
              </div>

              <form onSubmit={handleOnboardingSubmit} className="space-y-4 lg:space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">Nome da Organização</label>
                  <input
                    type="text"
                    value={nomeOrganizacao}
                    onChange={(e) => setNomeOrganizacao(e.target.value)}
                    className="w-full p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                    placeholder="Ex: Federação Paulista de Judô"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">Seu Nome (Administrador)</label>
                  <input
                    type="text"
                    value={nomeAdmin}
                    onChange={(e) => setNomeAdmin(e.target.value)}
                    className="w-full p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                    placeholder="Seu melhor e-mail"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">Senha</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                    placeholder="Mínimo de 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>

                {displayError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 lg:p-4 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-red-700 hover:bg-red-800 text-white p-3 lg:p-4 rounded-xl font-bold text-base lg:text-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Criar Conta'
                  )}
                </button>
              </form>
            </>
          )}

          {mode === 'check_zempo' && (
            <>
              <div className="mb-6 lg:mb-8">
                <button 
                  onClick={() => setMode('login')}
                  className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o login
                </button>
                <h2 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1 lg:mb-2">
                  Primeiro Acesso
                </h2>
                <p className="text-slate-500 text-sm lg:text-base">
                  Para ativar sua conta, informe seu número ZEMPO.
                </p>
              </div>

              <form onSubmit={handleCheckZempoSubmit} className="space-y-4 lg:space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">Número ZEMPO</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={zempo}
                      onChange={(e) => setZempo(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="Ex: 123456"
                      required
                    />
                  </div>
                </div>

                {displayError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 lg:p-4 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-red-700 hover:bg-red-800 text-white p-3 lg:p-4 rounded-xl font-bold text-base lg:text-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Continuar'
                  )}
                </button>
              </form>
            </>
          )}

          {mode === 'complete_signup' && userData && (
            <>
              <div className="mb-6 lg:mb-8">
                <button 
                  onClick={() => setMode('check_zempo')}
                  className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </button>
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-6 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-800">ZEMPO Encontrado!</h3>
                    <p className="text-sm text-green-700 mt-1">Olá, <strong>{userData.nome}</strong>. Para concluir a ativação da sua conta de {userRole === 'avaliador' ? 'Avaliador' : 'Candidato'}, preencha os dados abaixo.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCompleteSignupSubmit} className="space-y-4 lg:space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="Seu melhor e-mail"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">WhatsApp</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 lg:mb-2">Criar Senha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full pl-12 lg:pl-12 p-3 lg:p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm text-sm lg:text-base"
                      placeholder="Mínimo de 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {displayError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 lg:p-4 rounded-xl text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{displayError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-red-700 hover:bg-red-800 text-white p-3 lg:p-4 rounded-xl font-bold text-base lg:text-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 lg:w-6 lg:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Ativar Conta e Entrar'
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 lg:mt-8 text-center text-xs lg:text-sm text-slate-500">
            <p>Problemas para acessar? Entre em contato através do portal judotech.com.br</p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 lg:mt-auto pt-4 pb-4 lg:pb-0 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium text-sm lg:text-base">
            Desenvolvido por <span className="font-black text-slate-900">Judô<span className="text-red-600">Tech</span></span>
          </div>
          <p className="text-slate-500 text-[10px] lg:text-xs mt-1">Tradição no tatame, inovação na gestão.</p>
        </div>
      </div>
    </div>
  );
}
