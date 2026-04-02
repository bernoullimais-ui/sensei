import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Clock, AlertCircle, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface RealizarProvaProps {
  candidatoId: string;
}

export function RealizarProva({ candidatoId }: RealizarProvaProps) {
  const [provasDisponiveis, setProvasDisponiveis] = useState<any[]>([]);
  const [provasRealizadas, setProvasRealizadas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado da prova em andamento
  const [provaAtiva, setProvaAtiva] = useState<any | null>(null);
  const [questoesProva, setQuestoesProva] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [questaoAtualIndex, setQuestaoAtualIndex] = useState(0);
  const [tempoRestante, setTempoRestante] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<any | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);
  const [isAlert, setIsAlert] = useState(false);

  useEffect(() => {
    fetchProvas();
  }, [candidatoId]);

  useEffect(() => {
    let timer: any;
    if (provaAtiva && tempoRestante !== null && tempoRestante > 0) {
      timer = setInterval(() => {
        setTempoRestante(prev => {
          if (prev && prev <= 1) {
            clearInterval(timer);
            finalizarProva();
            return 0;
          }
          return prev ? prev - 1 : 0;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [provaAtiva, tempoRestante]);

  const fetchProvas = async () => {
    setIsLoading(true);
    try {
      // Buscar todas as provas
      const { data: provas, error: provasError } = await supabase
        .from('provas_teoricas')
        .select('*')
        .order('data_inicio', { ascending: true });

      if (provasError && provasError.code !== '42P01') throw provasError;

      // Buscar resultados do candidato
      const { data: resultados, error: resultadosError } = await supabase
        .from('prova_resultados')
        .select('*')
        .eq('candidato_id', candidatoId);

      if (resultadosError && resultadosError.code !== '42P01') throw resultadosError;

      const agora = new Date();
      const resultadosIds = new Set((resultados || []).map(r => r.prova_id));

      const disponiveis: any[] = [];
      const realizadas: any[] = [];

      (provas || []).forEach(p => {
        const fim = new Date(p.data_fim);

        if (resultadosIds.has(p.id)) {
          const res = (resultados || []).find(r => r.prova_id === p.id);
          realizadas.push({ ...p, resultado: res });
        } else if (agora <= fim) {
          disponiveis.push(p);
        }
      });

      setProvasDisponiveis(disponiveis);
      setProvasRealizadas(realizadas);
    } catch (err: any) {
      console.error('Erro ao buscar provas:', err);
      if (err.code !== '42P01') {
        setError('Não foi possível carregar as provas.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const iniciarProva = async (prova: any) => {
    setIsLoading(true);
    try {
      // Buscar questões da prova
      const { data: relacoes, error: relError } = await supabase
        .from('prova_questoes')
        .select('questao_id, ordem')
        .eq('prova_id', prova.id)
        .order('ordem', { ascending: true });

      if (relError) throw relError;

      if (!relacoes || relacoes.length === 0) {
        setModalMessage('Esta prova não possui questões cadastradas.');
        setIsAlert(true);
        setModalOpen(true);
        setIsLoading(false);
        return;
      }

      const qIds = relacoes.map(r => r.questao_id);
      const { data: questoes, error: qError } = await supabase
        .from('questoes_teoricas')
        .select('id, texto, opcao_a, opcao_b, opcao_c, opcao_d, opcao_e') // Não traz o gabarito para o cliente!
        .in('id', qIds);

      if (qError) throw qError;

      // Ordenar conforme a relação
      const questoesOrdenadas = relacoes.map(r => questoes?.find(q => q.id === r.questao_id)).filter(Boolean);

      setQuestoesProva(questoesOrdenadas);
      setProvaAtiva(prova);
      setQuestaoAtualIndex(0);
      setRespostas({});
      setTempoRestante(prova.duracao_minutos * 60);
      setResultadoFinal(null);
    } catch (err: any) {
      console.error('Erro ao iniciar prova:', err);
      setModalMessage('Erro ao carregar a prova.');
      setIsAlert(true);
      setModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const responderQuestao = (questaoId: string, opcao: string) => {
    setRespostas(prev => ({ ...prev, [questaoId]: opcao }));
  };

  const finalizarProva = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Buscar gabarito no servidor para calcular a nota
      const qIds = questoesProva.map(q => q.id);
      const { data: gabaritos, error: gabError } = await supabase
        .from('questoes_teoricas')
        .select('id, gabarito')
        .in('id', qIds);

      if (gabError) throw gabError;

      let acertos = 0;
      const respostasParaSalvar = [];

      for (const q of questoesProva) {
        const respostaDada = respostas[q.id] || null;
        const gabaritoCorreto = gabaritos?.find(g => g.id === q.id)?.gabarito;

        if (respostaDada && respostaDada === gabaritoCorreto) {
          acertos++;
        }

        if (respostaDada) {
          respostasParaSalvar.push({
            prova_id: provaAtiva.id,
            candidato_id: candidatoId,
            questao_id: q.id,
            resposta: respostaDada
          });
        }
      }

      const notaFinal = (acertos / questoesProva.length) * 10;

      // Salvar respostas
      if (respostasParaSalvar.length > 0) {
        await supabase.from('prova_respostas').insert(respostasParaSalvar);
      }

      // Salvar resultado
      const { data: resultadoSalvo, error: resError } = await supabase.from('prova_resultados').insert([{
        prova_id: provaAtiva.id,
        candidato_id: candidatoId,
        nota: notaFinal
      }]).select();

      if (resError) throw resError;

      setResultadoFinal({
        nota: notaFinal,
        acertos,
        total: questoesProva.length
      });
      
      // Atualizar lista de provas
      fetchProvas();

    } catch (err: any) {
      console.error('Erro ao finalizar prova:', err);
      setModalMessage('Erro ao enviar respostas. Tente novamente.');
      setIsAlert(true);
      setModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading && !provaAtiva) {
    return <div className="p-8 text-center text-slate-500">Carregando provas...</div>;
  }

  if (resultadoFinal) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center animate-in zoom-in-95">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Prova Finalizada!</h2>
        <p className="text-slate-600 mb-6">Suas respostas foram enviadas com sucesso.</p>
        
        <div className="bg-slate-50 p-6 rounded-lg max-w-sm mx-auto mb-8 border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">Nota Final</div>
          <div className={`text-4xl font-black ${resultadoFinal.nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
            {resultadoFinal.nota.toFixed(1)}
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {resultadoFinal.acertos} acertos de {resultadoFinal.total} questões
          </div>
        </div>

        <button 
          onClick={() => {
            setProvaAtiva(null);
            setResultadoFinal(null);
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
        >
          Voltar para Minhas Provas
        </button>
      </div>
    );
  }

  if (provaAtiva) {
    const questao = questoesProva[questaoAtualIndex];
    const respondidas = Object.keys(respostas).length;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
        {/* Header da Prova */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-bold text-lg">{provaAtiva.titulo}</h2>
            <div className="text-slate-300 text-sm">Questão {questaoAtualIndex + 1} de {questoesProva.length}</div>
          </div>
          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-2 rounded-md ${tempoRestante && tempoRestante < 300 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700'}`}>
            <Clock className="w-5 h-5" />
            {tempoRestante !== null ? formatTempo(tempoRestante) : '--:--'}
          </div>
        </div>

        {/* Progresso */}
        <div className="bg-slate-100 h-2 w-full shrink-0">
          <div 
            className="bg-red-500 h-full transition-all duration-300"
            style={{ width: `${(respondidas / questoesProva.length) * 100}%` }}
          ></div>
        </div>

        {/* Área da Questão */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-medium text-slate-800 mb-8 leading-relaxed">
              {questao.texto}
            </h3>

            <div className="space-y-3">
              {['A', 'B', 'C', 'D', 'E'].map((letra) => {
                const opcaoKey = `opcao_${letra.toLowerCase()}` as keyof typeof questao;
                const textoOpcao = questao[opcaoKey];
                const isSelected = respostas[questao.id] === letra;
                
                if (!textoOpcao) return null;

                return (
                  <label 
                    key={letra}
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="pt-0.5">
                      <input 
                        type="radio" 
                        name={`questao_${questao.id}`}
                        value={letra}
                        checked={isSelected}
                        onChange={() => responderQuestao(questao.id, letra)}
                        className="w-5 h-5 text-red-600 focus:ring-red-500"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold mr-2 text-slate-500">{letra})</span>
                      <span className={isSelected ? 'text-red-900 font-medium' : 'text-slate-700'}>{textoOpcao}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer / Navegação */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0">
          <div className="max-w-3xl mx-auto flex justify-between items-center">
            <button
              onClick={() => setQuestaoAtualIndex(prev => Math.max(0, prev - 1))}
              disabled={questaoAtualIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" /> Anterior
            </button>

            {questaoAtualIndex === questoesProva.length - 1 ? (
              <button
                onClick={() => {
                  if (Object.keys(respostas).length < questoesProva.length) {
                    setModalMessage('Você ainda não respondeu todas as questões. Tem certeza que deseja finalizar?');
                  } else {
                    setModalMessage('Tem certeza que deseja finalizar a prova?');
                  }
                  setIsAlert(false);
                  setModalAction(() => finalizarProva);
                  setModalOpen(true);
                }}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Finalizar Prova'} <CheckCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setQuestaoAtualIndex(prev => Math.min(questoesProva.length - 1, prev + 1))}
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-medium transition-colors"
              >
                Próxima <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 animate-in zoom-in-95">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle className={`w-6 h-6 ${isAlert ? 'text-red-500' : 'text-blue-500'}`} />
                {isAlert ? 'Atenção' : 'Confirmação'}
              </h3>
              <p className="text-slate-600 mb-6">{modalMessage}</p>
              <div className="flex justify-end gap-3">
                {!isAlert && (
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => {
                    setModalOpen(false);
                    if (modalAction) modalAction();
                  }}
                  className={`px-4 py-2 text-white rounded-md font-medium transition-colors ${
                    isAlert ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-red-600" /> Provas Disponíveis
        </h2>
        
        {provasDisponiveis.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
            Nenhuma prova teórica disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {provasDisponiveis.map(p => {
              const agora = new Date();
              const inicio = new Date(p.data_inicio);
              const isFutura = agora < inicio;

              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-red-300 transition-colors shadow-sm">
                  <h3 className="font-bold text-lg text-slate-800 mb-2">{p.titulo}</h3>
                  <div className="space-y-1 mb-6 text-sm text-slate-600">
                    <p><strong>Duração:</strong> {p.duracao_minutos} minutos</p>
                    {isFutura ? (
                      <p className="text-blue-600 font-medium"><strong>Inicia em:</strong> {inicio.toLocaleString('pt-BR')}</p>
                    ) : (
                      <p><strong>Encerra em:</strong> {new Date(p.data_fim).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => iniciarProva(p)}
                    disabled={isFutura}
                    className={`w-full py-2 rounded-md font-medium transition-colors ${
                      isFutura 
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isFutura ? 'Aguardando Início' : 'Iniciar Prova'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-600" /> Provas Realizadas
        </h2>
        
        {provasRealizadas.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
            Você ainda não realizou nenhuma prova.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                  <th className="p-4 font-semibold">Prova</th>
                  <th className="p-4 font-semibold">Data de Realização</th>
                  <th className="p-4 font-semibold text-center">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {provasRealizadas.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-800">{p.titulo}</td>
                    <td className="p-4 text-slate-600">
                      {p.resultado?.finalizada_em ? new Date(p.resultado.finalizada_em).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                        p.resultado?.nota >= 6 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {Number(p.resultado?.nota || 0).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle className={`w-6 h-6 ${isAlert ? 'text-red-500' : 'text-blue-500'}`} />
              {isAlert ? 'Atenção' : 'Confirmação'}
            </h3>
            <p className="text-slate-600 mb-6">{modalMessage}</p>
            <div className="flex justify-end gap-3">
              {!isAlert && (
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  setModalOpen(false);
                  if (modalAction) modalAction();
                }}
                className={`px-4 py-2 text-white rounded-md font-medium transition-colors ${
                  isAlert ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
