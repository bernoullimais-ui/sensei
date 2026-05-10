import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, CheckCircle, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { ReviewExam } from './ReviewExam';

interface CandidatoExamesReviewProps {
  candidatoId: string;
  loggedUser: any;
  selectedExamId: string | null;
  setSelectedExamId: (id: string | null) => void;
}

export function CandidatoExamesReview({ candidatoId, loggedUser, selectedExamId, setSelectedExamId }: CandidatoExamesReviewProps) {
  const [provasRealizadas, setProvasRealizadas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProvas();
  }, [candidatoId]);

  const fetchProvas = async () => {
    setIsLoading(true);
    try {
      // 1. Get results
      const { data: resultados, error: resError } = await supabase
        .from('prova_resultados')
        .select('*')
        .eq('candidato_id', candidatoId)
        .eq('organizacao_id', loggedUser?.organizacao_id);

      if (resError) throw resError;

      if (!resultados || resultados.length === 0) {
        setProvasRealizadas([]);
        setIsLoading(false);
        return;
      }

      // 2. Get exam info for these results
      const provaIds = resultados.map(r => r.prova_id);
      const { data: provas, error: provasError } = await supabase
        .from('provas_teoricas')
        .select('*')
        .in('id', provaIds);

      if (provasError) throw provasError;

      const combined = (resultados || []).map(res => {
        const prova = provas?.find(p => p.id === res.prova_id);
        return {
          ...prova,
          resultado: res
        };
      });

      setProvasRealizadas(combined);
    } catch (error) {
      console.error('Erro ao buscar exames do candidato:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedExamId) {
    return <ReviewExam provaId={selectedExamId} candidatoId={candidatoId} onBack={() => setSelectedExamId(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mr-3" />
        <span className="text-slate-500 font-medium">Carregando exames do candidato...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in transition-all duration-500">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-600" /> Histórico de Provas Teóricas (Plataforma)
        </h3>
      </div>
      
      {provasRealizadas.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p>Este candidato ainda não realizou provas teóricas nesta plataforma.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">Título da Prova</th>
                <th className="p-4 font-bold">Data de Conclusão</th>
                <th className="p-4 font-bold text-center">Nota</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {provasRealizadas.map((p) => (
                <tr key={p.resultado.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{p.titulo}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.resultado.prova_id}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {new Date(p.resultado.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-4 text-center">
                    <div className={`text-lg font-black ${p.resultado.nota >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(p.resultado.nota).toFixed(1)}
                    </div>
                  </td>
                  <td className="p-4 text-center text-sm">
                    {p.resultado.nota >= 6 ? (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold text-[10px] border border-green-200 uppercase tracking-wider">
                        Aprovado
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-bold text-[10px] border border-red-200 uppercase tracking-wider">
                        Reprovado
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => setSelectedExamId(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-medium transition-colors mx-auto"
                    >
                      <Eye className="w-3.5 h-3.5" /> Revisar Respostas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
