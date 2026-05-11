import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, User, FileText, ExternalLink, ArrowLeft, UserCircle, Award, BarChart3, MapPin, Target, Lightbulb, TrendingUp, Star, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { CensoPerfil } from './CensoPerfil';
import { CurriculoCandidato } from './CurriculoCandidato';
import { ReviewExam } from './ReviewExam';
import { CandidatoExamesReview } from './CandidatoExamesReview';
import { DashboardCenso } from './DashboardCenso';
import { getNextDan, calculateCurriculumPoints, getRequiredPoints } from './CurriculoCandidato.utils';

interface PerfisAdminProps {
  loggedUser: any;
  showToast?: (text: string, type: 'error' | 'success' | 'info') => void;
}

export function PerfisAdmin({ loggedUser, showToast }: PerfisAdminProps) {
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pointsFilter, setPointsFilter] = useState<'todos' | 'alcancou' | 'pendente'>('todos');
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'perfil' | 'curriculo' | 'avaliacoes'>('list');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidatos();
  }, [loggedUser]);

  const fetchCandidatos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidatos')
        .select('*')
        .eq('organizacao_id', loggedUser?.organizacao_id)
        .order('nome');

      if (error) throw error;
      
      // Filter candidates who have at least something in curriculo_json
      // The user wants those who "completed their profile and curriculum"
      const withProfile = (data || []).filter(c => 
        c.curriculo_json && 
        (c.curriculo_json.perfil || Object.keys(c.curriculo_json).length > 1)
      );

      setCandidatos(withProfile);
    } catch (err) {
      console.error('Erro ao buscar candidatos:', err);
      if (showToast) showToast('Erro ao carregar candidatos.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCandidatos = candidatos.filter(c => {
    const matchesSearch = (c.nome && c.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.grau_pretendido && c.grau_pretendido.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.dojo && c.dojo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (pointsFilter === 'todos') return true;

    const totalPoints = calculateCurriculumPoints(c.curriculo_json);
    const targetPoints = getRequiredPoints(c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao));
    const reached = totalPoints >= targetPoints;

    return pointsFilter === 'alcancou' ? reached : !reached;
  });

  const [activeTab, setActiveTab] = useState<'lista' | 'evolucao' | 'dashboard'>('lista');

  if (viewMode !== 'list' && selectedCandidate) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setViewMode('list'); setSelectedCandidate(null); }}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedCandidate.nome}</h2>
                <p className="text-sm text-slate-500">
                  {selectedCandidate.curriculo_json?.grauPretendido || selectedCandidate.grau_pretendido || getNextDan(selectedCandidate.grau_atual || selectedCandidate.graduacao)} • {selectedCandidate.dojo}
                </p>
              </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setViewMode('perfil')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'perfil' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <UserCircle className="w-4 h-4" /> Perfil/Censo
            </button>
            <button 
              onClick={() => setViewMode('curriculo')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'curriculo' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Award className="w-4 h-4" /> Currículo
            </button>
            <button 
              onClick={() => setViewMode('avaliacoes')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'avaliacoes' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <FileText className="w-4 h-4" /> Avaliações Provas
            </button>
          </div>
        </div>

        {viewMode === 'perfil' ? (
          <CensoPerfil candidato={selectedCandidate} />
        ) : viewMode === 'curriculo' ? (
          <CurriculoCandidato candidato={selectedCandidate} onShowToast={showToast} />
        ) : (
          <CandidatoExamesReview 
            candidatoId={selectedCandidate.id} 
            loggedUser={loggedUser} 
            selectedExamId={selectedExamId}
            setSelectedExamId={setSelectedExamId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-red-600" /> Perfis e Currículos
          </h2>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setActiveTab('lista')}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === 'lista' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Lista de Candidatos
            </button>
            <button 
              onClick={() => setActiveTab('evolucao')}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === 'evolucao' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Evolução Curricular
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Dashboard Censo
            </button>
          </div>
        </div>
        <div className="text-sm text-slate-500 font-medium">
          {candidatos.length} candidato(s) encontrado(s)
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, grau ou dojo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
        </div>
        <select
          value={pointsFilter}
          onChange={(e) => setPointsFilter(e.target.value as any)}
          className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-sm font-medium text-slate-700 min-w-[200px]"
        >
          <option value="todos">Todos os Candidatos</option>
          <option value="alcancou">Meta de Pontos Alcançada</option>
          <option value="pendente">Pontuação Pendente</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          Carregando perfis...
        </div>
      ) : filteredCandidatos.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum candidato com perfil preenchido encontrado.</p>
        </div>
      ) : activeTab === 'lista' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">Candidato</th>
                <th className="p-4 font-bold">Grau Pretendido</th>
                <th className="p-4 font-bold">Dojo / Clube</th>
                <th className="p-4 font-bold">Evolução</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidatos.map((c) => {
                const hasPerfil = !!c.curriculo_json?.perfil;
                const hasCurriculo = c.curriculo_json && Object.keys(c.curriculo_json).length > (hasPerfil ? 1 : 0);
                
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{c.nome}</div>
                      <div className="text-xs text-slate-500">ID: {c.id.substring(0, 8)}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-bold border border-red-100" title={`Graduação Atual: ${c.grau_atual || c.graduacao || '?'}`}>
                        {c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {c.dojo || 'Não informado'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                            <div 
                              className="h-full bg-red-600 rounded-full" 
                              style={{ width: `${Math.min(100, (calculateCurriculumPoints(c.curriculo_json) / getRequiredPoints(c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao))) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">
                            {Math.round((calculateCurriculumPoints(c.curriculo_json) / getRequiredPoints(c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao))) * 100)}%
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">
                           {calculateCurriculumPoints(c.curriculo_json)} / {getRequiredPoints(c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao))} pts
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        {hasPerfil && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            Perfil OK
                          </span>
                        )}
                        {hasCurriculo && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            Currículo OK
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedCandidate(c); setViewMode('perfil'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors"
                          title="Visualizar Perfil"
                        >
                          <UserCircle className="w-3.5 h-3.5" /> Perfil
                        </button>
                        <button
                          onClick={() => { setSelectedCandidate(c); setViewMode('curriculo'); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors"
                          title="Visualizar Currículo"
                        >
                          <Award className="w-3.5 h-3.5" /> Currículo
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'evolucao' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidatos.map((c) => {
            const totalPoints = calculateCurriculumPoints(c.curriculo_json);
            const targetPoints = getRequiredPoints(c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao));
            const percentage = Math.round((totalPoints / targetPoints) * 100);
            
            const chartData = [
              { name: 'Alcançado', value: totalPoints },
              { name: 'Restante', value: Math.max(0, targetPoints - totalPoints) }
            ];

            return (
              <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-red-700 transition-colors">{c.nome}</h3>
                    <p className="text-xs text-slate-500 font-medium">{c.dojo} • <span className="text-red-600">{c.curriculo_json?.grauPretendido || c.grau_pretendido || getNextDan(c.grau_atual || c.graduacao)}</span></p>
                  </div>
                  <button 
                    onClick={() => { setSelectedCandidate(c); setViewMode('curriculo'); }}
                    className="p-2 hover:bg-red-100 hover:text-red-700 rounded-full transition-all text-slate-400"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={22}
                          outerRadius={30}
                          startAngle={90}
                          endAngle={-270}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#dc2626" />
                          <Cell fill="#f1f5f9" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-700">{percentage}%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pontuação Total</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-red-600">{totalPoints}</span>
                      <span className="text-[10px] font-bold text-slate-400">/ {targetPoints} pts</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                   <button
                    onClick={() => { setSelectedCandidate(c); setViewMode('perfil'); }}
                    className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors"
                  >
                    Ver Perfil
                  </button>
                  <button
                    onClick={() => { setSelectedCandidate(c); setViewMode('curriculo'); }}
                    className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors"
                  >
                    Ver Currículo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardCenso candidatos={candidatos} />
      )}
    </div>
  );
}
