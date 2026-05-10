import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  GraduationCap, 
  MessageSquare, 
  Bell, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface ManagerDashboardProps {
  loggedUser: any;
  orgId: string;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ loggedUser, orgId }) => {
  const [stats, setStats] = useState({
    totalCandidatos: 0,
    totalAvaliadores: 0,
    activeCourses: 0,
    pendingMessages: 0,
    recentCommunityPosts: 0,
    completionsByMonth: [] as any[],
    evaluationSummary: [] as any[],
    courseEnrollments: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [orgId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [
        candRes, 
        evalRes, 
        coursesRes, 
        messagesRes, 
        communityRes,
        enrollRes,
        resultsRes,
        examResultsRes
      ] = await Promise.all([
        supabase.from('candidatos').select('id', { count: 'exact' }).eq('organizacao_id', orgId),
        supabase.from('avaliadores').select('id', { count: 'exact' }).eq('organizacao_id', orgId),
        supabase.from('cursos').select('id', { count: 'exact' }).eq('organizacao_id', orgId),
        supabase.from('contatos_admin').select('id', { count: 'exact' }).eq('organizacao_id', orgId).eq('respondido', false),
        supabase.from('comunidade_posts').select('id', { count: 'exact' }).eq('organizacao_id', orgId).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('inscricoes_cursos').select('id, created_at, status').eq('organizacao_id', orgId),
        supabase.from('resultados_modulos').select('id, veredito, created_at').eq('organizacao_id', orgId),
        supabase.from('prova_resultados').select('id, nota, created_at').eq('organizacao_id', orgId)
      ]);

      // Process Enrollments by Month (last 6 months)
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: d.toLocaleString('pt-BR', { month: 'short' }),
          yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          count: 0
        };
      });

      if (enrollRes.data) {
        enrollRes.data.forEach(sub => {
          const date = new Date(sub.created_at);
          const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthIdx = last6Months.findIndex(m => m.yearMonth === ym);
          if (monthIdx !== -1) last6Months[monthIdx].count++;
        });
      }

      // Process Evaluation Summary (Modules + Theoretical Exams)
      const evalCounts = { Aprovado: 0, Reprovado: 0, Pendente: 0 };
      
      // Modules
      if (resultsRes.data) {
        resultsRes.data.forEach(r => {
          if (r.veredito === 'Aprovado') evalCounts.Aprovado++;
          else if (r.veredito === 'Reprovado') evalCounts.Reprovado++;
          else evalCounts.Pendente++;
        });
      }

      // Exams
      if (examResultsRes.data) {
        examResultsRes.data.forEach(r => {
          // Assuming 6.0 as passing grade for theoretical exams
          if (r.nota >= 6) evalCounts.Aprovado++;
          else evalCounts.Reprovado++;
        });
      }

      setStats({
        totalCandidatos: candRes.count || 0,
        totalAvaliadores: evalRes.count || 0,
        activeCourses: coursesRes.count || 0,
        pendingMessages: messagesRes.count || 0,
        recentCommunityPosts: communityRes.count || 0,
        completionsByMonth: last6Months,
        evaluationSummary: [
          { name: 'Aprovados', value: evalCounts.Aprovado, color: '#10b981' },
          { name: 'Reprovados', value: evalCounts.Reprovado, color: '#ef4444' },
          { name: 'Em Análise', value: evalCounts.Pendente, color: '#f59e0b' }
        ],
        courseEnrollments: last6Months
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-red-600" /> Dashboard do Gestor
        </h2>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Última atualização: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Users className="w-6 h-6" />}
          label="Total de Candidatos"
          value={stats.totalCandidatos}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard 
          icon={<GraduationCap className="w-6 h-6" />}
          label="Avaliadores"
          value={stats.totalAvaliadores}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard 
          icon={<MessageSquare className="w-6 h-6" />}
          label="Mensagens Pendentes"
          value={stats.pendingMessages}
          color="bg-amber-50 text-amber-600"
          alert={stats.pendingMessages > 0}
        />
        <StatCard 
          icon={<Bell className="w-6 h-6" />}
          label="Posts na Comunidade (7d)"
          value={stats.recentCommunityPosts}
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollments Trend */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-red-600" /> Tendência de Inscrições (Cursos)
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.courseEnrollments}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#dc2626" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evaluation Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-red-600" /> Resumo de Avaliações
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.evaluationSummary}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.evaluationSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {stats.evaluationSummary.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs font-bold text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Layout - Messages & Community Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm border border-amber-100">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h4 className="font-bold text-amber-800">Mensagens de Suporte</h4>
            <p className="text-sm text-amber-700/80 mb-2">Você tem {stats.pendingMessages} mensagens aguardando resposta oficial.</p>
            <button className="text-sm font-bold text-amber-600 hover:underline">Ver todas as mensagens →</button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm border border-blue-100">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-bold text-blue-800">Atividade na Comunidade</h4>
            <p className="text-sm text-blue-700/80 mb-2">{stats.recentCommunityPosts} novos tópicos ou comentários nos últimos 7 dias.</p>
            <button className="text-sm font-bold text-blue-600 hover:underline">Ir para comunidade →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  alert?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, alert }) => (
  <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group transition-all hover:shadow-md ${alert ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}>
    <div className="flex flex-col">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-2xl font-black text-slate-800">{value}</span>
    </div>
    <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
  </div>
);
