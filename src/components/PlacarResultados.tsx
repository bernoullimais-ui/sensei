import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, AlertCircle, Trophy, Users, User } from 'lucide-react';

interface PlacarProps {
  moduloId: string;
}

export function PlacarResultados({ moduloId }: PlacarProps) {
  const [resultados, setResultados] = useState<any[]>([]);
  const [modulo, setModulo] = useState<any>(null);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: modData, error: modError } = await supabase.from('modulos_avaliacao').select('*').eq('id', moduloId).single();
        if (modError) throw modError;
        
        if (modData) {
          setModulo(modData);
          
          const [resRes, candRes] = await Promise.all([
            supabase.from('avaliacoes').select('*').eq('modulo_id', moduloId).order('created_at', { ascending: false }),
            supabase.from('candidatos').select('*').eq('organizacao_id', modData.organizacao_id)
          ]);

          if (resRes.data) setResultados(resRes.data);
          if (candRes.data) setCandidatos(candRes.data);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do placar:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (moduloId) {
      fetchData();
    }

    const channel = supabase.channel(`placar_${moduloId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'avaliacoes',
        filter: `modulo_id=eq.${moduloId}`
      }, () => {
        // Recarregar os resultados quando houver mudança
        supabase.from('avaliacoes')
          .select('*')
          .eq('modulo_id', moduloId)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) setResultados(data);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [moduloId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!modulo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">Módulo não encontrado</h2>
        </div>
      </div>
    );
  }

  // Filtrar resultados para mostrar apenas após 3 minutos
  const resultadosFiltrados = resultados.filter(res => {
    const createdAt = new Date(res.created_at).getTime();
    return currentTime - createdAt >= 3 * 60 * 1000;
  });

  // Agrupar resultados por candidato
  const groups: Record<string, any> = {};
  resultadosFiltrados.forEach(res => {
    const key = res.candidato_id;
    if (!groups[key]) {
      const candidato = candidatos.find(c => c.id === key);
      groups[key] = {
        id: key,
        created_at: res.created_at,
        candidato_nome: res.candidato_nome,
        dojo: candidato?.dojo || 'Não informado',
        grau_pretendido: res.grau_pretendido,
        waza_scores: [],
        kata_scores: [],
        vereditos: [],
        avaliacoes: []
      };
    }
    groups[key].avaliacoes.push(res);
    if (res.percentual_waza !== null && res.percentual_waza !== undefined) {
      groups[key].waza_scores.push(res.percentual_waza);
    }
    if (res.nota_kata !== null && res.nota_kata !== undefined) {
      groups[key].kata_scores.push(res.nota_kata);
    }
    if (res.veredito) {
      groups[key].vereditos.push(res.veredito);
    }
  });

  const aggregatedResultados = Object.values(groups).map(group => {
    const avgWaza = group.waza_scores.length > 0 
      ? Math.round(group.waza_scores.reduce((a: number, b: number) => a + b, 0) / group.waza_scores.length) 
      : null;
    const avgKata = group.kata_scores.length > 0 
      ? Math.round(group.kata_scores.reduce((a: number, b: number) => a + b, 0) / group.kata_scores.length) 
      : null;
    
    let finalVeredito = 'Pendente';
    const aprovados = group.vereditos.filter((v: string) => v === 'Aprovado').length;
    const reprovados = group.vereditos.filter((v: string) => v === 'Reprovado').length;
    
    if (aprovados > reprovados) finalVeredito = 'Aprovado';
    else if (reprovados > aprovados) finalVeredito = 'Reprovado';

    return {
      ...group,
      avgWaza,
      avgKata,
      finalVeredito
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const ultimoResultado = aggregatedResultados.length > 0 ? aggregatedResultados[0] : null;
  const isKatas = modulo.tema === 'Katas';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Placar de Resultados
            </h1>
            <p className="text-slate-500 mt-1">
              Módulo: <span className="font-medium text-slate-700">{modulo.tema}</span> • {new Date(modulo.data).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {ultimoResultado ? (
          <>
            {/* Último Resultado Concluído (Destaque) */}
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
              <div className="bg-blue-600 p-4 text-white">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Último Resultado Concluído
                </h2>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{ultimoResultado.candidato_nome}</h3>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                        {ultimoResultado.dojo}
                      </span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        {ultimoResultado.grau_pretendido}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-center">
                      <p className="text-sm text-slate-500 font-medium mb-1">Média Geral</p>
                      <p className="text-3xl font-black text-slate-800">
                        {isKatas 
                          ? (ultimoResultado.avgKata !== null ? `${ultimoResultado.avgKata}%` : 'N/A') 
                          : (ultimoResultado.avgWaza !== null ? `${ultimoResultado.avgWaza}%` : 'N/A')}
                      </p>
                    </div>
                    <div className="h-12 w-px bg-slate-200"></div>
                    <div className="text-center">
                      <p className="text-sm text-slate-500 font-medium mb-1">Veredito</p>
                      <div className={`flex items-center gap-1.5 font-bold ${
                        ultimoResultado.finalVeredito === 'Aprovado' ? 'text-green-600' : 
                        ultimoResultado.finalVeredito === 'Reprovado' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {ultimoResultado.finalVeredito === 'Aprovado' && <CheckCircle2 className="w-5 h-5" />}
                        {ultimoResultado.finalVeredito === 'Reprovado' && <XCircle className="w-5 h-5" />}
                        {ultimoResultado.finalVeredito === 'Pendente' && <AlertCircle className="w-5 h-5" />}
                        {ultimoResultado.finalVeredito}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalhes por Avaliador */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Detalhes por Avaliador</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ultimoResultado.avaliacoes.map((av: any) => (
                      <div key={av.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="font-medium text-slate-800 mb-2 truncate" title={av.avaliador_nome}>
                          {av.avaliador_nome}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold text-blue-600">
                            {isKatas 
                              ? (av.nota_kata !== null && av.nota_kata !== undefined ? `${av.nota_kata}%` : 'N/A') 
                              : (av.percentual_waza !== null && av.percentual_waza !== undefined ? `${av.percentual_waza}%` : 'N/A')}
                          </span>
                          <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                            av.veredito === 'Aprovado' ? 'bg-green-100 text-green-700' : 
                            av.veredito === 'Reprovado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {av.veredito}
                          </span>
                        </div>
                        
                        {isKatas && (() => {
                          const parseJsonArray = (val: any) => {
                            if (!val) return [];
                            if (Array.isArray(val)) return val;
                            try { return JSON.parse(val); } catch (e) { return []; }
                          };
                          const errosKata = parseJsonArray(av.erros_kata);
                          
                          if (errosKata.length > 0) {
                            return (
                              <div className="mt-4 pt-3 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Erros Registrados:</p>
                                <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-4">
                                  {errosKata.map((erro: string, idx: number) => (
                                    <li key={idx} className="leading-tight">{erro}</li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista dos Últimos Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-500" />
                  Histórico do Módulo
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-sm uppercase tracking-wider">
                      <th className="p-4 font-medium border-b border-slate-200">Candidato</th>
                      <th className="p-4 font-medium border-b border-slate-200">Dojo</th>
                      <th className="p-4 font-medium border-b border-slate-200">Graduação</th>
                      <th className="p-4 font-medium border-b border-slate-200 text-center">Média Final</th>
                      <th className="p-4 font-medium border-b border-slate-200 text-center">Veredito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aggregatedResultados.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-800">{res.candidato_nome}</td>
                        <td className="p-4 text-slate-600">{res.dojo}</td>
                        <td className="p-4 text-slate-600">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium">
                            {res.grau_pretendido}
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-800">
                          {isKatas ? (res.avgKata !== null ? `${res.avgKata}%` : 'N/A') : (res.avgWaza !== null ? `${res.avgWaza}%` : 'N/A')}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                            res.finalVeredito === 'Aprovado' ? 'bg-green-50 text-green-700' : 
                            res.finalVeredito === 'Reprovado' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {res.finalVeredito}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Nenhum resultado ainda</h3>
            <p className="text-slate-500">As avaliações concluídas para este módulo aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
