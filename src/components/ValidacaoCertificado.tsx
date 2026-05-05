import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Award, Calendar, User, BookOpen, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';

interface ValidacaoCertificadoProps {
  idCertificado?: string;
}

const ValidacaoCertificado: React.FC<ValidacaoCertificadoProps> = ({ idCertificado }) => {
  const [id, setId] = useState<string | null>(idCertificado || null);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);

  useEffect(() => {
    // Busca o logo da primeira organização encontrada como fallback global
    const fetchGlobalLogo = async () => {
      try {
        const { data } = await supabase.from('organizacoes').select('logo_url').limit(1).maybeSingle();
        if (data?.logo_url) setOrgLogo(data.logo_url);
      } catch (e) {
        console.warn("Could not fetch global logo", e);
      }
    };
    fetchGlobalLogo();

    if (!id) {
      if (window.location.pathname.startsWith('/validar/')) {
        const parts = window.location.pathname.split('/');
        const pathId = parts[parts.length - 1];
        if (pathId) setId(pathId);
      }
    }
  }, [id, idCertificado]);

  useEffect(() => {
    const validar = async () => {
      if (!id || id === 'temp') {
        if (id === 'temp') {
          setErro(null);
          setLoading(true);
          // Wait a bit if it's 'temp', maybe it's just being generated? 
          // Actually, 'temp' is just a placeholder.
        }
        setErro('ID de certificado inválido ou não fornecido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro(null);

      try {
        // 1. Tentar Módulos (modulo_participantes) - CORE
        const { data: modCore } = await supabase
          .from('modulo_participantes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (modCore) {
          const { data: cand } = await supabase.from('candidatos').select('*').eq('id', modCore.candidato_id).maybeSingle();
          const { data: modulo } = await supabase.from('modulos_avaliacao').select('*').eq('id', modCore.modulo_id).maybeSingle();
          
          if (modulo?.organizacao_id) {
            const { data: org } = await supabase.from('organizacoes').select('logo_url').eq('id', modulo.organizacao_id).maybeSingle();
            if (org?.logo_url) setOrgLogo(org.logo_url);
          }

          setDados({
            tipo: 'Módulo de Padronização',
            nome: cand?.nome || 'Participante',
            titulo: modulo?.tema || 'Módulo de Avaliação',
            data: modulo?.data || modCore.created_at || '--',
            cargaHoraria: modulo?.carga_horaria || '--',
            valido: true
          });
          setLoading(false);
          return;
        }

        // 2. Tentar Cursos (curso_participantes) - CORE
        const { data: cursoCore } = await supabase
          .from('curso_participantes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (cursoCore) {
          const { data: usuario } = await supabase.from('usuarios').select('*').eq('id', cursoCore.usuario_id).maybeSingle();
          const { data: curso } = await supabase.from('cursos').select('*').eq('id', cursoCore.curso_id).maybeSingle();

          if (curso?.organizacao_id) {
            const { data: org } = await supabase.from('organizacoes').select('logo_url').eq('id', curso.organizacao_id).maybeSingle();
            if (org?.logo_url) setOrgLogo(org.logo_url);
          }

          setDados({
            tipo: 'Curso Livre / Evento',
            nome: usuario?.nome || 'Participante',
            titulo: curso?.nome || 'Curso Online',
            data: cursoCore.updated_at || cursoCore.created_at || '--',
            cargaHoraria: curso?.carga_horaria || '--',
            valido: true
          });
          setLoading(false);
          return;
        }

        // 3. Tentar Treinamentos (treinamento_participantes) - CORE
        const { data: treinaCore } = await supabase
          .from('treinamento_participantes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (treinaCore) {
          const { data: treina } = await supabase.from('treinamentos').select('*').eq('id', treinaCore.treinamento_id).maybeSingle();

          if (treina?.organizacao_id) {
            const { data: org } = await supabase.from('organizacoes').select('logo_url').eq('id', treina.organizacao_id).maybeSingle();
            if (org?.logo_url) setOrgLogo(org.logo_url);
          }

          setDados({
            tipo: 'Treinamento / Capacitação',
            nome: treinaCore.nome || 'Participante',
            titulo: treina?.nome || 'Treinamento Técnico',
            data: treina?.data || treinaCore.created_at || '--',
            cargaHoraria: treina?.carga_horaria || '--',
            valido: true
          });
          setLoading(false);
          return;
        }

        setErro('Nenhum registro de certificado encontrado para este código.');
      } catch (err) {
        console.error('Erro na validação:', err);
        setErro('Ocorreu um erro ao consultar o sistema de validação. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    validar();
  }, [id]);

  const defaultLogo = "https://feba-ju-gestao-faixas.retool.com/api/file/0c978052-959c-4f7f-8d2a-433c6f4460f1";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header Branding */}
        <div className="bg-red-600 p-10 text-center text-white relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white scale-150"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white p-3 rounded-2xl shadow-lg mb-6 w-24 h-24 flex items-center justify-center">
              <img 
                src={orgLogo || defaultLogo} 
                alt="Logo FEBAJU" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  setOrgLogo(null);
                  (e.target as HTMLImageElement).src = '/judo_tech_icon.png';
                }}
              />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-1 uppercase">FEBAJU</h1>
            <p className="text-red-100 text-sm font-medium tracking-wide">Portal de Validação Digital</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-slate-400 font-medium animate-pulse">Autenticando documento...</p>
            </div>
          ) : erro ? (
            <div className="text-center py-4">
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 border-4 border-red-100">
                <XCircle size={64} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Não Encontrado</h2>
              <p className="text-slate-500 leading-relaxed mb-8 px-4">{erro}</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transform active:scale-[0.98] transition-all shadow-lg"
              >
                Voltar à Página Inicial
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 border-4 border-green-100">
                  <CheckCircle size={64} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Certificado Autêntico</h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck size={14} /> Documento Verificado
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <User size={18} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Participante Oficial</span>
                  </div>
                  <p className="text-xl font-black text-slate-900 ml-1">{dados.nome}</p>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Award size={18} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualificação Registrada</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 ml-1 leading-tight">{dados.titulo}</p>
                  <p className="text-xs text-slate-500 ml-1 mt-1 font-medium">{dados.tipo}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</span>
                    </div>
                    <p className="font-bold text-slate-900 ml-1">
                      {dados.data && dados.data !== '--' 
                        ? new Date(dados.data).toLocaleDateString('pt-BR') 
                        : '--'}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <BookOpen size={18} className="text-slate-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horas</span>
                    </div>
                    <p className="font-bold text-slate-900 ml-1">{dados.cargaHoraria || '--'} h</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Código de Autenticidade</p>
                <div className="inline-block relative">
                  <div className="absolute -inset-1 bg-slate-100 rounded-lg blur-[2px]"></div>
                  <code className="relative text-xs bg-white px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-mono shadow-sm">
                    {id}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      
      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="text-slate-400 text-[10px] text-center max-w-xs leading-relaxed uppercase tracking-tighter opacity-80">
          Este sistema de validação é exclusivo para certificados emitidos através do portal oficial de Gestão de Faixas FEBAJU.
        </p>
        <div className="flex gap-4 grayscale opacity-40">
          <img src="https://upload.wikimedia.org/wikipedia/pt/2/2a/Escudo_jud%C3%B4_Brasil.png" className="h-8 object-contain" alt="CBJ" />
          <img src="/judo_tech_icon.png" className="h-8 object-contain" alt="System" />
        </div>
      </div>
    </div>
  );
};

export default ValidacaoCertificado;
