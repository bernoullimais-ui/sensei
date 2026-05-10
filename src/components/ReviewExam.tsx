import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowLeft, Clock, Award } from 'lucide-react';

interface ReviewExamProps {
  provaId: string;
  candidatoId: string;
  onBack: () => void;
}

export function ReviewExam({ provaId, candidatoId, onBack }: ReviewExamProps) {
  const [prova, setProva] = useState<any>(null);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch exam details
        const { data: provaData, error: provaError } = await supabase
          .from('provas_teoricas')
          .select('*')
          .eq('id', provaId)
          .single();

        if (provaError) throw provaError;
        setProva(provaData);

        // 2. Fetch questions for this exam
        const { data: relacoes, error: relError } = await supabase
          .from('prova_questoes')
          .select('questao_id, ordem')
          .eq('prova_id', provaId)
          .order('ordem', { ascending: true });

        if (relError) throw relError;

        const qIds = relacoes.map(r => r.questao_id);
        const { data: questionsData, error: qError } = await supabase
          .from('questoes_teoricas')
          .select('*')
          .in('id', qIds);

        if (qError) throw qError;

        // Sort questions by order
        const sortedQuestions = relacoes.map(r => questionsData?.find(q => q.id === r.questao_id)).filter(Boolean);
        setQuestoes(sortedQuestions);

        // 3. Fetch candidate's answers
        const { data: respData, error: respError } = await supabase
          .from('prova_respostas')
          .select('*')
          .eq('prova_id', provaId)
          .eq('candidato_id', candidatoId);

        if (respError) throw respError;

        const respMap: Record<string, string> = {};
        respData?.forEach(r => {
          respMap[r.questao_id] = r.resposta;
        });
        setRespostas(respMap);

      } catch (error) {
        console.error('Erro ao carregar revisão da prova:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [provaId, candidatoId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando revisão da prova...</p>
      </div>
    );
  }

  if (!prova) {
    return (
      <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Prova não encontrada</h2>
        <button onClick={onBack} className="mt-4 text-red-600 font-medium hover:underline">Voltar</button>
      </div>
    );
  }

  const score = questoes.length > 0 
    ? (questoes.filter(q => respostas[q.id] === q.gabarito).length / questoes.length) * 10 
    : 0;

  const acertos = questoes.filter(q => respostas[q.id] === q.gabarito).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white p-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">{prova.titulo}</h2>
              <p className="text-slate-400 mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Revisão de Avaliação Teórica
              </p>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-700/50 p-4 rounded-xl border border-slate-600">
              <div className="text-center">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Nota</p>
                <p className={`text-3xl font-black ${score >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                  {score.toFixed(1)}
                </p>
              </div>
              <div className="h-10 w-px bg-slate-600"></div>
              <div className="text-center px-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Resultado</p>
                <div className={`flex items-center gap-1 font-bold ${score >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                  {score >= 6 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {score >= 6 ? 'Aprovado' : 'Reprovado'}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-600"></div>
              <div className="text-center">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Acertos</p>
                <p className="text-xl font-bold">{acertos}/{questoes.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Questoes */}
        <div className="p-6 md:p-8 space-y-10">
          {questoes.map((q, idx) => {
            const userResp = respostas[q.id];
            const isCorrect = userResp === q.gabarito;
            
            return (
              <div key={q.id} className="relative pl-12 border-l-2 border-slate-100">
                <div className="absolute -left-[14px] top-0 w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
                  {idx + 1}
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">
                  {q.texto}
                </h3>

                <div className="grid grid-cols-1 gap-3 max-w-3xl">
                  {['A', 'B', 'C', 'D', 'E'].map((letra) => {
                    const text = q[`opcao_${letra.toLowerCase()}`];
                    if (!text) return null;

                    const isUserChoice = userResp === letra;
                    const isGabarito = q.gabarito === letra;

                    let bgColor = 'bg-white';
                    let borderColor = 'border-slate-200';
                    let textColor = 'text-slate-700';
                    let icon = null;

                    if (isGabarito) {
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-500';
                      textColor = 'text-green-900';
                      if (isUserChoice) {
                        icon = <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />;
                      }
                    } else if (isUserChoice && !isCorrect) {
                      bgColor = 'bg-red-50';
                      borderColor = 'border-red-500';
                      textColor = 'text-red-900';
                      icon = <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
                    }

                    return (
                      <div 
                        key={letra}
                        className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${bgColor} ${borderColor}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          isGabarito ? 'bg-green-500 text-white' : 
                          (isUserChoice && !isCorrect) ? 'bg-red-500 text-white' : 
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {letra}
                        </div>
                        <div className={`flex-1 text-sm ${isUserChoice || isGabarito ? 'font-medium' : ''} ${textColor}`}>
                          {text}
                        </div>
                        {icon}
                        {isGabarito && !isUserChoice && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            Correta
                          </span>
                        )}
                        {isUserChoice && !isCorrect && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-100 px-2 py-0.5 rounded">
                            Sua Resposta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
