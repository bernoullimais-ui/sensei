import React from 'react';
import { Award, PlayCircle, MessagesSquare, BookOpen } from 'lucide-react';

export function CandidatoDashboardView({ 
  onNavigate,
  resultados,
  cursos,
  pendingMessagesCount,
  newPostsCount,
  curriculoProgress
}: { 
  onNavigate: (tab: 'curriculo' | 'resultados' | 'cursos' | 'comunidade', subTab?: 'feed' | 'messages') => void,
  resultados: any[],
  cursos: any[],
  pendingMessagesCount: number,
  newPostsCount?: number,
  curriculoProgress?: { pontos: number, maximo: number }
}) {
  const avaliacoesAprovadas = resultados.filter(r => r.veredito === 'Aprovado');
  const avaliacoesReprovadas = resultados.filter(r => r.veredito === 'Reprovado');
  const avaliacoesPendentes = resultados.filter(r => r.veredito !== 'Aprovado' && r.veredito !== 'Reprovado');

  const cursosEmAndamento = cursos.filter(c => c.progresso >= 0 && c.progresso < 100);
  const cursosConcluidos = cursos.filter(c => c.progresso === 100);

  const curriculoPercent = curriculoProgress && curriculoProgress.maximo > 0 
    ? Math.min(100, Math.round((curriculoProgress.pontos / curriculoProgress.maximo) * 100))
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('curriculo')}>
        <BookOpen className="w-10 h-10 text-indigo-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Currículo</h2>
        <div className="text-slate-500 mt-2 space-y-1">
          <div className="flex items-center gap-3">
             <div className="relative w-12 h-12 flex items-center justify-center rounded-full border-4 border-slate-100">
               <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-indigo-600"
                    strokeDasharray={`${curriculoPercent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
               </svg>
               <span className="text-xs font-bold text-slate-800">{curriculoPercent}%</span>
             </div>
             <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Pontuação Total</p>
                <p className="text-lg font-black text-slate-800">{curriculoProgress?.pontos || 0} <span className="text-sm font-semibold text-slate-400">/ {curriculoProgress?.maximo || 0} pts</span></p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('cursos')}>
        <PlayCircle className="w-10 h-10 text-blue-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Cursos</h2>
        <div className="text-slate-500 mt-2 space-y-1">
            <p className="text-sm font-medium">Em andamento: {cursosEmAndamento.length}</p>
            {cursosEmAndamento.map((c, i) => <p key={i} className="text-xs truncate text-blue-600 font-semibold">({c.progresso}%) {c.cursos?.nome || "Curso"}</p>)}
            <p className="text-sm font-medium mt-2">Concluídos: {cursosConcluidos.length}</p>
            {cursosConcluidos.map((c, i) => <p key={i} className="text-xs truncate text-emerald-600 font-semibold">(100%) {c.cursos?.nome || "Curso"}</p>)}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('resultados')}>
        <Award className="w-10 h-10 text-emerald-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Avaliações</h2>
        <div className="text-slate-500 mt-2 space-y-1">
            <p className="text-sm font-medium">Total: {resultados.length}</p>
            <p className="text-sm font-medium mt-2">Aprovadas: {avaliacoesAprovadas.length}</p>
            {avaliacoesAprovadas.map(a => <p key={a.id} className="text-xs truncate text-emerald-600 font-semibold">{a.modulo_nome || "Avaliação"}</p>)}
            <p className="text-sm font-medium mt-2">Reprovadas: {avaliacoesReprovadas.length}</p>
            {avaliacoesReprovadas.map(a => <p key={a.id} className="text-xs truncate text-red-600 font-semibold">{a.modulo_nome || "Avaliação"}</p>)}
            <p className="text-sm font-medium mt-2">Pendentes: {avaliacoesPendentes.length}</p>
            {avaliacoesPendentes.map(a => <p key={a.id} className="text-xs truncate text-amber-600 font-semibold">{a.modulo_nome || "Avaliação"}</p>)}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('comunidade', 'messages')}>
        <MessagesSquare className="w-10 h-10 text-amber-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Comunidade</h2>
        <div className="mt-2 space-y-1">
          <p className="text-slate-500 text-sm font-medium">Você tem {pendingMessagesCount} mensagem(ns) pendente(s).</p>
          {newPostsCount !== undefined && (
            <p className="text-amber-600 text-sm font-medium mt-1 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onNavigate('comunidade', 'feed'); }}>
              {newPostsCount} nova(s) postagem(ns) na comunidade.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
