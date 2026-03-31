import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TreinamentoExecution } from './TreinamentoCapacitacao';
import { LogIn, User, Lock, Mail, Phone, ArrowRight, AlertTriangle } from 'lucide-react';

interface TreinamentoParticipantFlowProps {
  treinamentoId: string;
}

export function TreinamentoParticipantFlow({ treinamentoId }: TreinamentoParticipantFlowProps) {
  const [step, setStep] = useState<'loading' | 'login' | 'setup' | 'execution'>('loading');
  const [treinamento, setTreinamento] = useState<any>(null);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [loggedParticipant, setLoggedParticipant] = useState<any>(null);

  // Login state
  const [loginZempo, setLoginZempo] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [loginError, setLoginError] = useState('');

  // Setup state
  const [setupEmail, setSetupEmail] = useState('');
  const [setupWhatsapp, setSetupWhatsapp] = useState('');
  const [setupSenha, setSetupSenha] = useState('');
  const [setupConfirmSenha, setSetupConfirmSenha] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time status updates
    const channel = supabase
      .channel(`participant_treinamento_status_${treinamentoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'treinamentos',
          filter: `id=eq.${treinamentoId}`
        },
        (payload) => {
          if (payload.new && payload.new.status) {
            setTreinamento((prev: any) => prev ? { ...prev, status: payload.new.status } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [treinamentoId]);

  const fetchData = async () => {
    try {
      const [treinRes, partRes, tecRes] = await Promise.all([
        supabase.from('treinamentos').select('*').eq('id', treinamentoId).single(),
        supabase.from('treinamento_participantes').select('*').eq('treinamento_id', treinamentoId),
        supabase.from('treinamento_tecnicas').select('*').eq('treinamento_id', treinamentoId).order('fase').order('ordem')
      ]);

      if (treinRes.error) throw treinRes.error;
      if (partRes.error) throw partRes.error;
      if (tecRes.error) throw tecRes.error;

      if (treinRes.data) setTreinamento(treinRes.data);
      if (partRes.data) setParticipantes(partRes.data);
      if (tecRes.data) setTecnicas(tecRes.data);
      
      setStep('login');
    } catch (err) {
      console.error('Erro ao carregar dados do treinamento:', err);
      setLoginError('Erro ao carregar treinamento. Verifique o link.');
      setStep('login');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginZempo || !loginSenha) {
      setLoginError('Preencha o Zempo e a Senha.');
      return;
    }

    const participante = participantes.find(p => p.zempo === loginZempo);

    if (!participante) {
      setLoginError('Participante não encontrado com este Zempo.');
      return;
    }

    // Se o participante ainda não tem senha cadastrada
    if (!participante.senha) {
      // A senha inicial deve ser igual ao Zempo
      if (loginSenha === loginZempo) {
        setLoggedParticipant(participante);
        setSetupEmail(participante.email || '');
        setSetupWhatsapp(participante.whatsapp || '');
        setStep('setup');
      } else {
        setLoginError('Para o primeiro acesso, a senha é igual ao seu Zempo.');
      }
      return;
    }

    // Se já tem senha cadastrada
    if (participante.senha === loginSenha) {
      setLoggedParticipant(participante);
      setStep('execution');
    } else {
      setLoginError('Senha incorreta.');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!setupEmail || !setupWhatsapp || !setupSenha || !setupConfirmSenha) {
      setSetupError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (setupSenha !== setupConfirmSenha) {
      setSetupError('As senhas não conferem.');
      return;
    }

    if (setupSenha.length < 6) {
      setSetupError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('treinamento_participantes')
        .update({
          email: setupEmail,
          whatsapp: setupWhatsapp,
          senha: setupSenha
        })
        .eq('id', loggedParticipant.id)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setLoggedParticipant(data[0]);
        // Atualiza a lista de participantes com os novos dados
        setParticipantes(participantes.map(p => p.id === data[0].id ? data[0] : p));
        setStep('execution');
      }
    } catch (err) {
      console.error('Erro ao salvar dados:', err);
      setSetupError('Erro ao salvar seus dados. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-medium">Carregando treinamento...</div>
      </div>
    );
  }

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-red-700 p-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Acesso ao Treinamento</h1>
            <p className="text-red-100 text-sm">{treinamento?.nome || 'Verificando acesso...'}</p>
          </div>
          <div className="p-6">
            {!treinamento ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-800 mb-2">Treinamento não encontrado</h2>
                <p className="text-slate-600 mb-6">Verifique se o link de acesso está correto.</p>
                {loginError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{loginError}</p>}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Zempo (Login)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={loginZempo}
                      onChange={(e) => setLoginZempo(e.target.value)}
                      className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="Digite seu nº Zempo"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder="Primeiro acesso: repita o Zempo"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Se for seu primeiro acesso, a senha é o seu Zempo.</p>
                </div>

                {loginError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-red-700 hover:bg-red-800 text-white p-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors mt-6"
                >
                  <LogIn className="w-5 h-5" /> Entrar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 p-6 text-center">
            <h1 className="text-xl font-bold text-white mb-1">Complete seu Cadastro</h1>
            <p className="text-slate-300 text-sm">Olá, {loggedParticipant?.nome}</p>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-6">
              Para continuar, precisamos que você confirme seus contatos e crie uma nova senha de acesso.
            </p>
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={setupWhatsapp}
                    onChange={(e) => setSetupWhatsapp(e.target.value)}
                    className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="pt-2 border-t mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={setupSenha}
                    onChange={(e) => setSetupSenha(e.target.value)}
                    className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={setupConfirmSenha}
                    onChange={(e) => setSetupConfirmSenha(e.target.value)}
                    className="pl-10 w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              {setupError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {setupError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white p-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors mt-6 disabled:opacity-70"
              >
                {isSaving ? 'Salvando...' : (
                  <>Salvar e Continuar <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'execution') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <header className="bg-red-700 text-white p-4 shadow-md">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
                {loggedParticipant?.nome?.charAt(0)}
              </div>
              <span className="font-medium">{loggedParticipant?.nome}</span>
            </div>
            <button 
              onClick={() => {
                setLoggedParticipant(null);
                setLoginSenha('');
                setStep('login');
              }}
              className="text-red-100 hover:text-white text-sm"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto p-4 sm:p-6">
          <TreinamentoExecution 
            treinamento={{...treinamento, status: treinamento.status}} 
            participantes={participantes} 
            tecnicas={tecnicas} 
            loggedParticipant={loggedParticipant}
            onBack={() => {
              // No back action needed here, maybe just logout
              setLoggedParticipant(null);
              setLoginSenha('');
              setStep('login');
            }} 
          />
        </main>
      </div>
    );
  }

  return null;
}
