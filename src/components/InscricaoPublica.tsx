import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, CreditCard } from 'lucide-react';
import { PaymentModal } from './PaymentModal';

export function InscricaoPublica({ tipo, id, onComplete }: { tipo: 'curso' | 'modulo', id: string, onComplete: () => void }) {
  const [entity, setEntity] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingParticipantId, setPendingParticipantId] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntity = async () => {
      if (import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
        setError('Configuração do banco de dados pendente.');
        setIsLoading(false);
        return;
      }

      try {
        let fetchId = id;
        let table = tipo === 'curso' ? 'cursos' : 'modulos_avaliacao';
        
        const { data, error: fetchErr } = await supabase.from(table).select('*').eq('id', fetchId).single();
        if (fetchErr) {
          console.error('Fetch error:', fetchErr);
          if (fetchErr.message.includes('fetch')) {
            setError('Erro de conexão. Verifique se o banco de dados está acessível.');
          } else {
            setError('Conteúdo não encontrado ou link inválido.');
          }
          setIsLoading(false);
          return;
        }
        if (!data) {
          setError('Conteúdo não encontrado.');
          setIsLoading(false);
          return;
        }
        setEntity(data);
        
        const orgId = data.organizacao_id || '00000000-0000-0000-0000-000000000000';
        const { data: orgData, error: orgErr } = await supabase.from('organizacoes').select('*').eq('id', orgId).single();
        if (orgData) setOrg(orgData);
      } catch (err: any) {
        console.error('Unexpected error:', err);
        setError('Erro inesperado ao carregar os dados.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEntity();
  }, [id, tipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim() || !telefone.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const orgId = entity.organizacao_id || '00000000-0000-0000-0000-000000000000';
      if (!orgId) throw new Error('Organização não identificada.');

      // 1. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha
      });
      
      if (authError) {
        if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
          throw new Error('E-mail já está em uso. Por favor, faça login com a sua conta e se inscreva por dentro da plataforma.');
        }
        throw authError;
      }
      
      if (!authData.user) throw new Error('Falha ao criar usuário.');
      const userId = authData.user.id;

      // 2. Insert into usuarios
      const { error: userErr } = await supabase.from('usuarios').insert([{
        id: userId,
        nome: nome.trim(),
        email: email.trim(),
        role: 'ouvinte',
        tipo_inscricao: tipo,
        organizacao_id: orgId
      }]);
      if (userErr) throw userErr;

      // 3. Insert into candidatos (REQUIRED for module link)
      const { data: candData, error: candErr } = await supabase.from('candidatos').insert([{
        nome: nome.trim(),
        zempo: '',
        dojo: '',
        grau_pretendido: 'Iniciante',
        organizacao_id: orgId
      }]).select().single();
      
      if (candErr) throw new Error('Não foi possível criar seu perfil de candidato: ' + candErr.message);
      if (!candData) throw new Error('Falha ao gerar registro de candidato.');

      // 4. Update usuarios reference
      await supabase.from('usuarios').update({ reference_id: candData.id }).eq('id', userId);

      let participantId = '';

      // 5. Enroll based on type
      if (tipo === 'curso') {
        const { data: partData, error: partErr } = await supabase.from('curso_participantes').insert([{
          curso_id: entity.id,
          usuario_id: userId,
          status: entity.preco === 'pago' ? 'aguardando_pagamento' : 'andamento',
          progresso: 0
        }]).select().single();
        if (partErr) throw partErr;
        participantId = partData.id;
      } else if (tipo === 'modulo') {
        const { data: partData, error: partErr } = await supabase.from('modulo_participantes').insert([{
          modulo_id: entity.id,
          candidato_id: candData.id,
          presente: true,
          status: entity.preco === 'pago' ? 'aguardando_pagamento' : 'pago'
        }]).select().single();
        if (partErr) throw new Error('Não foi possível vincular ao módulo: ' + partErr.message);
        participantId = partData.id;
      }

      const isPaid = entity.preco === 'pago' && entity.valor > 0;

      if (isPaid) {
        setPendingParticipantId(participantId);
        setShowPaymentModal(true);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 3000);
      }

    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Erro ao realizar inscrição.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow border border-slate-200 text-center max-w-md w-full">
          <p className="text-red-500 font-semibold mb-4">{error}</p>
          <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-slate-800 text-white rounded font-medium hover:bg-slate-700">Ir para Home</button>
        </div>
      </div>
    );
  }

  const corOrg = org?.cor_primaria || '#b91c1c';

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{ backgroundColor: corOrg }}>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?q=80&w=2049&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-black/30"></div>
        
        <div className="relative z-10 p-12 flex flex-col items-center text-center text-white max-w-lg">
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.nome} className="w-[160px] h-auto object-contain mb-8 drop-shadow-lg bg-white/10 p-4 rounded-xl backdrop-blur-sm" />
          ) : (
            <img src="/judo_tech_icon.png" alt="Logo" className="w-[160px] h-[160px] object-contain brightness-0 invert drop-shadow-2xl mb-8" />
          )}
          
          <h1 className="text-4xl font-black tracking-tight drop-shadow-md mb-2">
            Inscrição - {tipo === 'curso' ? 'Programa' : 'Avaliação'}
          </h1>
          <p className="text-xl text-white/90 drop-shadow mb-8 font-medium">
            {entity.nome || entity.tema}
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 min-h-screen lg:min-h-0 overflow-y-auto">
        <div className="w-full max-w-md flex-1 flex flex-col justify-center">
          
          <div className="lg:hidden flex flex-col items-center mb-8">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.nome} className="h-[80px] object-contain mb-4" />
            ) : (
              <img src="/judo_tech_icon.png" alt="Logo" className="w-[80px] h-[80px] object-contain mb-4" />
            )}
            <h1 className="text-2xl font-black text-slate-900 text-center">Inscrição</h1>
            <p className="text-slate-600 text-center font-medium mt-1">{entity.nome || entity.tema}</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Faça sua Inscrição
            </h2>
            <p className="text-slate-500">
              Preencha os dados abaixo para criar seu perfil e se inscrever como ouvinte ou participante.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <ShieldCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Inscrição Confirmada!</h3>
              <p className="text-slate-600 mb-6">Sua conta foi criada e você já está inscrito. Redirecionando para a plataforma...</p>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome Completo</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                  placeholder="Seu nome"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone (WhatsApp)</label>
                <input 
                  type="tel" 
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
                <input 
                  type="password" 
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-medium text-slate-900 placeholder:font-normal"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Crie uma senha para acessar {tipo === 'curso' ? 'os treinamentos' : 'a plataforma'}.</p>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-lg text-white font-bold text-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: corOrg }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processando...</span>
                    </>
                  ) : (
                    'Finalizar Inscrição'
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-8 border-t border-slate-200">
            <p className="text-center text-sm text-slate-600">
              Já tem uma conta?{' '}
              <button onClick={() => window.location.href = '/'} className="font-semibold text-blue-600 hover:underline">
                Faça login aqui
              </button>
            </p>
          </div>
        </div>
      </div>
      
      {showPaymentModal && pendingParticipantId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          participantId={pendingParticipantId}
          item={{
            id: entity.id,
            description: entity.nome || entity.tema || `Inscrição - ${tipo === 'curso' ? 'Programa' : 'Módulo'}`,
            amount: entity.valor || 0,
            type: tipo
          }}
          customer={{
            name: nome,
            email: email,
            phone: telefone
          }}
        />
      )}
    </div>
  );
}
