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
    if (orgId) {
      fetchDashboardData();
    }
  }, [orgId, loggedUser?.id]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Get current auth user ID for messages
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const messagesId = authUser?.id || loggedUser.auth_id || loggedUser.id;

      console.log('ManagerDashboard: Starting fetch for orgId:', orgId);

      // Fetch course IDs for this organization first to use in enrollments query
      let { data: orgCourses, error: coursesIdsError } = await supabase.from('cursos').select('id').eq('organizacao_id', orgId);
      
      if (coursesIdsError) console.error('ManagerDashboard: coursesIdsError:', coursesIdsError);
      
      // Fallback: if no courses found with orgId, try to find courses where orgId is null (orphaned or global)
      if (!orgCourses || orgCourses.length === 0) {
        console.log('ManagerDashboard: No courses found for orgId, trying to fetch courses with null organizacao_id...');
        const { data: legacyCourses } = await supabase.from('cursos').select('id, nome').is('organizacao_id', null);
        if (legacyCourses && legacyCourses.length > 0) {
          console.log(`ManagerDashboard: Found ${legacyCourses.length} legacy/global courses. Including them.`);
          orgCourses = legacyCourses;
        }
      }

      const courseIds = orgCourses?.map(c => c.id) || [];
      console.log('ManagerDashboard: final courseIds for stats:', courseIds);

      const [
        candRes, 
        evalRes, 
        coursesResTotal, 
        messagesRes, 
        communityRes,
        enrollResOriginal,
        resultsRes,
        examResultsRes,
        manualTheoryRes
      ] = await Promise.all([
        supabase.from('candidatos').select('id', { count: 'exact' }).eq('organizacao_id', orgId),
        supabase.from('avaliadores').select('id', { count: 'exact' }).eq('organizacao_id', orgId),
        supabase.from('cursos').select('id', { count: 'exact' }), // Total accessible courses
        supabase.from('community_messages').select('id', { count: 'exact' }).eq('receiver_id', messagesId).eq('read', false),
        supabase.from('community_posts').select('id', { count: 'exact' }).eq('organizacao_id', orgId).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        courseIds.length > 0 
          ? supabase.from('curso_participantes').select('id, created_at, status').in('curso_id', courseIds)
          : supabase.from('curso_participantes').select('id, created_at, status').limit(200), // Broad fallback if no course IDs filtered
        // For results, we select minimal fields. We rely on RLS but keep the filter for safety
        supabase.from('avaliacoes').select('veredito').eq('organizacao_id', orgId),
        supabase.from('prova_resultados').select('nota').eq('organizacao_id', orgId),
        supabase.from('avaliacoes_teoricas').select('media').eq('organizacao_id', orgId)
      ]);

      if (resultsRes.error) console.error('ManagerDashboard: resultsRes error:', resultsRes.error);
      if (examResultsRes.error) console.error('ManagerDashboard: examResultsRes error:', examResultsRes.error);
      if (manualTheoryRes.error) console.error('ManagerDashboard: manualTheoryRes error:', manualTheoryRes.error);

      // Enrollment Fallback: if no enrollments found with specific course IDs, try a broader query
      let finalEnrollments = enrollResOriginal.data || [];
      if (finalEnrollments.length === 0 && !enrollResOriginal.error) {
        console.log('ManagerDashboard: No enrollments found for current filter, fetching all accessible for stats...');
        const { data: fallbackEnroll } = await supabase.from('curso_participantes').select('id, created_at').order('created_at', { ascending: false }).limit(500);
        if (fallbackEnroll && fallbackEnroll.length > 0) {
          console.log(`ManagerDashboard: Found ${fallbackEnroll.length} enrollments via broad fallback!`);
          finalEnrollments = fallbackEnroll;
        }
      }

      // If results are empty with filter, try to check if they exist at all for this user (RLS will filter)
      let finalResults = resultsRes.data || [];
      if (finalResults.length === 0 && !resultsRes.error) {
        console.log('ManagerDashboard: No results found with org filter, trying without explicit filter (relying on RLS)...');
        const { data: fallbackRes } = await supabase.from('avaliacoes').select('veredito').limit(100);
        if (fallbackRes && fallbackRes.length > 0) {
          console.log(`ManagerDashboard: Found ${fallbackRes.length} results without explicit filter! Using them.`);
          finalResults = fallbackRes;
        }
      }

      // Candidate Fallback: if 0 candidates found for org, check global access
      let finalCandCount = candRes.count || 0;
      if (finalCandCount === 0) {
        const { count: globalCandCount } = await supabase.from('candidatos').select('id', { count: 'exact', head: true });
        if (globalCandCount && globalCandCount > 0) finalCandCount = globalCandCount;
      }

      // Evaluator Fallback
      let finalEvalCount = evalRes.count || 0;
      if (finalEvalCount === 0) {
        const { count: globalEvalCount } = await supabase.from('avaliadores').select('id', { count: 'exact', head: true });
        if (globalEvalCount && globalEvalCount > 0) finalEvalCount = globalEvalCount;
      }

      console.log('Dashboard Data Raw:', { 
        orgId,
        candCount: finalCandCount, 
        enrollCount: finalEnrollments.length,
        resultsFound: finalResults.length,
        examsFound: examResultsRes.data?.length,
        manualFound: manualTheoryRes.data?.length
      });

      // Process Enrollments by Month (last 6 months)
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(1); // Set to 1st to avoid month overflow issues (e.g. March 31 -> Feb 28)
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: d.toLocaleString('pt-BR', { month: 'short' }),
          yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          count: 0
        };
      });

      if (finalEnrollments.length > 0) {
        finalEnrollments.forEach(sub => {
          if (!sub.created_at) return;
          const date = new Date(sub.created_at);
          const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthIdx = last6Months.findIndex(m => m.yearMonth === ym);
          if (monthIdx !== -1) last6Months[monthIdx].count++;
        });
      }

      // Process Evaluation Summary (Modules + Theoretical Exams)
      const evalCounts = { Aprovado: 0, Reprovado: 0, Pendente: 0 };
      
      // Modules
      finalResults.forEach(r => {
        const veredito = (r.veredito || '').trim().toLowerCase();
        if (veredito === 'aprovado') evalCounts.Aprovado++;
        else if (veredito === 'reprovado') evalCounts.Reprovado++;
        else evalCounts.Pendente++;
      });

      // Exams
      if (examResultsRes.data) {
        examResultsRes.data.forEach(r => {
          const nota = parseFloat(String(r.nota || 0));
          // Handle both 0-10 and 0-100 scales
          const percentual = nota <= 10 ? nota * 10 : nota;
          if (percentual >= 70) evalCounts.Aprovado++;
          else if (percentual >= 50) evalCounts.Pendente++;
          else evalCounts.Reprovado++;
        });
      }

      // Manual Theory
      if (manualTheoryRes.data) {
        manualTheoryRes.data.forEach(r => {
          const media = parseFloat(String(r.media || 0));
          const percentual = media <= 10 ? media * 10 : media;
          if (percentual >= 70) evalCounts.Aprovado++;
          else if (percentual >= 50) evalCounts.Pendente++;
          else evalCounts.Reprovado++;
        });
      }

      console.log('Final Eval Counts:', evalCounts);

      // Final stats update
      setStats({
        totalCandidatos: finalCandCount,
        totalAvaliadores: finalEvalCount,
        activeCourses: orgCourses?.length || 0,
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
          <div className="h-[250px] flex items-center justify-center">
            {stats.courseEnrollments.some(item => item.count > 0) ? (
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
            ) : (
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Nenhuma inscrição recente encontrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Evaluation Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-red-600" /> Resumo de Avaliações
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            {stats.evaluationSummary.some(item => item.value > 0) ? (
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
            ) : (
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Nenhuma avaliação realizada ainda</p>
              </div>
            )}
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
