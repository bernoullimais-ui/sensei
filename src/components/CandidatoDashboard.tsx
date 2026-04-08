import React, { useState, useMemo, useEffect } from 'react';
import { CheckSquare, FileText, LogOut, TrendingUp, Award, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { RealizarProva } from './RealizarProva';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

interface CandidatoDashboardProps {
  candidato: any;
  onLogout: () => void;
  resultados: any[];
  aggregatedResultados: any[];
  modulos: any[];
  orgSettings?: { nome: string, logo_url: string | null, cor_primaria: string } | null;
}

export function CandidatoDashboard({ candidato, onLogout, resultados, aggregatedResultados, modulos, orgSettings }: CandidatoDashboardProps) {
  const [activeTab, setActiveTab] = useState<'provas' | 'resultados'>('provas');
  const [selectedEval, setSelectedEval] = useState<any | null>(null);
  const [detailedData, setDetailedData] = useState<{waza: any[], kata: any[], kihon: any[]}>({ waza: [], kata: [], kihon: [] });
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Filter results for this candidate
  const myAggregatedResults = useMemo(() => {
    return aggregatedResultados
      .filter(r => r.candidato_id === (candidato.reference_id || candidato.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [aggregatedResultados, candidato]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!selectedEval) return;
      
      const isTeorica = selectedEval.isTeorica || selectedEval.isProvaTeorica;
      if (isTeorica) return;

      const relatedRawEvals = selectedEval.avaliacoes || [];

      const evalIds = relatedRawEvals.map((r: any) => r.id);
      if (evalIds.length === 0) return;

      setIsLoadingDetails(true);
      try {
        const [wazaRes, kataRes, kihonRes] = await Promise.all([
          supabase.from('avaliacao_waza').select('*').in('avaliacao_id', evalIds),
          supabase.from('avaliacao_kata').select('*').in('avaliacao_id', evalIds),
          supabase.from('avaliacao_kihon').select('*').in('avaliacao_id', evalIds)
        ]);

        setDetailedData({
          waza: wazaRes.data || [],
          kata: kataRes.data || [],
          kihon: kihonRes.data || []
        });
      } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedEval]);

  // Data for evolution chart
  const evolutionData = useMemo(() => {
    return myAggregatedResults.map(res => {
      const modulo = modulos.find(m => m.id === res.modulo_id);
      const isKatas = modulo?.tema === 'Katas';
      const score = res.isTeorica || res.isProvaTeorica 
        ? res.media_teorica 
        : isKatas ? res.nota_kata : res.percentual_waza;
        
      return {
        date: new Date(res.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        fullDate: new Date(res.created_at).toLocaleDateString('pt-BR'),
        score: score || 0,
        modulo: res.isTeorica || res.isProvaTeorica ? res.modulo_nome : (modulo?.nome || modulo?.tema || 'Desconhecido'),
        veredito: res.veredito
      };
    });
  }, [myAggregatedResults, modulos]);

  // Aggregate technique scores for charts
  const techniqueScores = useMemo(() => {
    if (!selectedEval) return [];
    const modulo = modulos.find(m => m.id === selectedEval.modulo_id);
    const isKatas = modulo?.tema === 'Katas';

    if (isKatas) {
      const kataMap = new Map();
      detailedData.kata.forEach(k => {
        if (!kataMap.has(k.kata_nome)) {
          kataMap.set(k.kata_nome, { name: k.kata_nome, totalErrors: 0, count: 0 });
        }
        const data = kataMap.get(k.kata_nome);
        data.totalErrors += (k.small_errors || 0) + (k.medium_errors || 0) * 3 + (k.grave_errors || 0) * 5;
        data.count += 1;
      });
      return Array.from(kataMap.values()).map(k => ({
        name: k.name,
        errosMedios: Math.round(k.totalErrors / k.count)
      }));
    } else {
      const wazaMap = new Map();
      const isHighDan = selectedEval.grau_pretendido === 'Yondan (4º Dan)' || selectedEval.grau_pretendido === 'Godan (5º Dan)';
      
      const getPoints = (status: string) => {
        if (!status) return 0;
        const s = status.trim().toLowerCase();
        if (s === 'ótimo' || s === 'otimo') return 100;
        if (s === 'bom') return 70;
        if (s === 'regular') return 50;
        if (s === 'realizada') return 100;
        if (s === 'parcialmente realizada') return 50;
        if (s === 'não realizada' || s === 'nao realizada') return 0;
        return 0;
      };

      detailedData.waza.forEach(w => {
        if (!wazaMap.has(w.tecnica_nome)) {
          wazaMap.set(w.tecnica_nome, { name: w.tecnica_nome, kuzushi: 0, tsukuri: 0, kake: 0, count: 0 });
        }
        const data = wazaMap.get(w.tecnica_nome);
        data.kuzushi += getPoints(w.kuzushi);
        data.tsukuri += getPoints(w.tsukuri);
        data.kake += getPoints(w.kake);
        data.count += 1;
      });
      const wazaScores = Array.from(wazaMap.values()).map(w => ({
        name: w.name,
        kuzushi: Math.round(w.kuzushi / w.count),
        tsukuri: Math.round(w.tsukuri / w.count),
        kake: Math.round(w.kake / w.count),
        media: Math.round((w.kuzushi + w.tsukuri + w.kake) / (w.count * 3)),
        type: 'waza'
      }));

      const kihonMap = new Map();
      detailedData.kihon.forEach(k => {
        if (!kihonMap.has(k.kihon_nome)) {
          kihonMap.set(k.kihon_nome, { name: k.kihon_nome, score: 0, count: 0 });
        }
        const data = kihonMap.get(k.kihon_nome);
        data.score += getPoints(k.status);
        data.count += 1;
      });
      const kihonScores = Array.from(kihonMap.values()).map(k => ({
        name: k.name,
        kihonScore: Math.round(k.score / k.count),
        type: 'kihon'
      }));

      return [...wazaScores, ...kihonScores];
    }
  }, [detailedData, selectedEval, modulos]);

  const renderResultados = () => {
    if (selectedEval) {
      const modulo = modulos.find(m => m.id === selectedEval.modulo_id);
      const isKatas = modulo?.tema === 'Katas';
      const isTeorica = selectedEval.isTeorica || selectedEval.isProvaTeorica;
      
      // Get all raw evaluations for this specific aggregated result
      const relatedRawEvals = selectedEval.avaliacoes || [];

      const isHighDan = selectedEval.grau_pretendido === 'Yondan (4º Dan)' || selectedEval.grau_pretendido === 'Godan (5º Dan)';

      // Extract unique study suggestions
      const uniqueStudySuggestions = Array.from(new Set(
        relatedRawEvals
          .map((r: any) => r.sugestao_estudo)
          .filter((s: string) => s && s.trim() !== '')
      ));

      return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
          <button 
            onClick={() => setSelectedEval(null)}
            className="mb-6 text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            &larr; Voltar para lista de resultados
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {isTeorica ? selectedEval.modulo_nome : (modulo?.nome || modulo?.tema || 'Avaliação')}
              </h2>
              <p className="text-slate-500 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" /> 
                {new Date(selectedEval.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
              selectedEval.veredito === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' :
              selectedEval.veredito === 'Reprovado' ? 'bg-red-100 text-red-800' :
              'bg-amber-100 text-amber-800'
            }`}>
              {selectedEval.veredito}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">Média Final</div>
              <div className="text-3xl font-black text-slate-800">
                {isTeorica 
                  ? `${selectedEval.media_teorica?.toFixed(1) || 0}%` 
                  : isKatas 
                    ? `${selectedEval.nota_kata || 0}%` 
                    : `${selectedEval.percentual_waza || 0}%`
                }
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">Grau Pretendido</div>
              <div className="text-xl font-bold text-slate-800 mt-2">{selectedEval.grau_pretendido}</div>
            </div>
            {!isTeorica && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-sm font-medium text-slate-500 mb-1">Avaliadores</div>
                <div className="text-xl font-bold text-slate-800 mt-2">{selectedEval.avaliadores_count}</div>
              </div>
            )}
          </div>

          {isLoadingDetails ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
          ) : (
            <>
              {!isTeorica && techniqueScores.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-6">Desempenho por Técnica</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={techniqueScores} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#64748b' }} 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          domain={isKatas ? [0, 'auto'] : [0, 100]} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#64748b' }} 
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#f1f5f9' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {isKatas ? (
                          <Bar dataKey="errosMedios" name="Pontos de Erro (Média)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        ) : (
                          <>
                            <Bar dataKey="kuzushi" name={isHighDan ? "Inovação" : "Kuzushi"} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="tsukuri" name={isHighDan ? "Eficiência" : "Tsukuri"} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="kake" name={isHighDan ? "Aplicabilidade" : "Kake"} fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="kihonScore" name="Nota Kihon" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {!isTeorica && uniqueStudySuggestions.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-6">Sugestão de Estudo</h3>
                  <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                    <ul className="space-y-3">
                      {uniqueStudySuggestions.map((sugestao, idx) => (
                        <li key={idx} className="text-sm text-slate-700 whitespace-pre-wrap flex items-start gap-2">
                          {uniqueStudySuggestions.length > 1 && <span className="text-blue-500 font-bold mt-0.5">&bull;</span>}
                          <span>{sugestao}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!isTeorica && relatedRawEvals.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Feedback dos Avaliadores</h3>
                  
                  {relatedRawEvals.map((evalData, idx) => (
                    <div key={evalData.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <div className="font-bold text-slate-700 flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            {idx + 1}
                          </div>
                          Avaliador {idx + 1}
                        </div>
                        <div className="text-sm font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                          Nota: {isKatas ? evalData.nota_kata : evalData.percentual_waza}%
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {evalData.observacoes_pedagogicas && (
                          <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                            <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2">Observações Pedagógicas</h4>
                            <div className="text-sm text-slate-700">
                              {(() => {
                                try {
                                  const obsArray = typeof evalData.observacoes_pedagogicas === 'string' 
                                    ? JSON.parse(evalData.observacoes_pedagogicas) 
                                    : evalData.observacoes_pedagogicas;
                                  
                                  if (Array.isArray(obsArray) && obsArray.length > 0) {
                                    return (
                                      <ul className="space-y-4">
                                        {obsArray.map((obs: string, i: number) => {
                                          const lines = obs.split('\n');
                                          return (
                                            <li key={i} className="flex flex-col">
                                              {lines.map((line, j) => {
                                                if (line.startsWith('**') && line.endsWith('**')) {
                                                  return <strong key={j} className="text-purple-900 mb-1">{line.replace(/\*\*/g, '')}</strong>;
                                                }
                                                return (
                                                  <span key={j} className="flex items-start gap-1 ml-2">
                                                    <span className="text-purple-500 font-bold mt-0.5">&bull;</span>
                                                    <span>{line}</span>
                                                  </span>
                                                );
                                              })}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    );
                                  }
                                  return <p className="whitespace-pre-wrap">{evalData.observacoes_pedagogicas}</p>;
                                } catch (e) {
                                  return <p className="whitespace-pre-wrap">{evalData.observacoes_pedagogicas}</p>;
                                }
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* Evolution Chart */}
        {evolutionData.length > 1 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" /> Histórico de Evolução
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value}%`, 'Nota']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke={orgSettings?.cor_primaria || '#b91c1c'} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-red-600" /> Minhas Avaliações
            </h2>
          </div>
          
          {myAggregatedResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Você ainda não possui resultados de avaliações.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myAggregatedResults.map((res) => {
                const modulo = modulos.find(m => m.id === res.modulo_id);
                const isKatas = modulo?.tema === 'Katas';
                const isTeorica = res.isTeorica || res.isProvaTeorica;
                const temaModulo = isTeorica ? res.modulo_nome : (modulo ? (modulo.nome || modulo.tema) : 'Desconhecido');
                
                const score = isTeorica 
                  ? res.media_teorica 
                  : isKatas ? res.nota_kata : res.percentual_waza;

                return (
                  <div 
                    key={res.id} 
                    onClick={() => setSelectedEval(res)}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        res.veredito === 'Aprovado' ? 'bg-emerald-100 text-emerald-600' :
                        res.veredito === 'Reprovado' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{temaModulo}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(res.created_at).toLocaleDateString('pt-BR')}</span>
                          <span>&bull;</span>
                          <span>Grau: {res.grau_pretendido}</span>
                          {isTeorica && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">Teórica</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pl-16 sm:pl-0">
                      <div className="text-center">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Nota</div>
                        <div className="font-black text-lg text-slate-800">{score !== null && score !== undefined ? `${score}%` : '-'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">Status</div>
                        <div className={`text-sm font-bold ${
                          res.veredito === 'Aprovado' ? 'text-emerald-600' :
                          res.veredito === 'Reprovado' ? 'text-red-600' :
                          'text-amber-600'
                        }`}>
                          {res.veredito}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="text-white p-6 shadow-md" style={{ backgroundColor: orgSettings?.cor_primaria || '#b91c1c' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {orgSettings?.logo_url ? (
              <img src={orgSettings.logo_url} alt="Logo da Organização" className="w-[80px] h-[80px] object-contain -mr-[10px] rounded-md bg-white/10 p-1" />
            ) : (
              <img src="/judo_tech_icon.png" alt="Logo" className="w-[80px] h-[80px] object-contain brightness-0 invert -mr-[10px]" />
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {orgSettings?.nome ? `Portal ${orgSettings.nome}` : 'Portal do'} <span className="text-red-200 font-normal">Candidato</span>
              </h1>
              <p className="text-red-100 text-sm">Olá, {candidato.nome}</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Main Navigation Tabs */}
            <div className="flex flex-wrap justify-center bg-red-800 rounded-lg p-1">
              <button 
                onClick={() => { setActiveTab('provas'); setSelectedEval(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'provas' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
              >
                <CheckSquare className="w-4 h-4" /> Minhas Provas
              </button>
              <button 
                onClick={() => setActiveTab('resultados')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'resultados' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
              >
                <FileText className="w-4 h-4" /> Meus Resultados
              </button>
            </div>

            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-red-100 hover:text-white text-sm font-medium"
              title="Sair"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-8 px-4">
        {activeTab === 'provas' && (
          <RealizarProva candidatoId={candidato.reference_id || candidato.id} loggedUser={candidato} />
        )}
        
        {activeTab === 'resultados' && (
          renderResultados()
        )}
      </main>
    </div>
  );
}
