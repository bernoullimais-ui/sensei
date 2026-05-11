import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { MapPin, Target, Lightbulb, TrendingUp, Star } from 'lucide-react';

interface DashboardCensoProps {
  candidatos: any[];
}

export function DashboardCenso({ candidatos }: DashboardCensoProps) {
  const aggregateData = () => {
    const dataWithPerfil = candidatos.filter(c => c.curriculo_json?.perfil);
    
    // Região
    const regioesCount: Record<string, number> = {};
    // Atuação
    const atuacaoCount: Record<string, number> = {};
    // Motivação
    const motivacaoCount: Record<string, number> = {};
    // Visão
    const visaoCount: Record<string, number> = {};
    
    // Autoavaliação averages
    let totalFundamentos = 0;
    let totalNageWaza = 0;
    let totalKatameWaza = 0;
    let totalKata = 0;
    let countAval = 0;

    dataWithPerfil.forEach(c => {
      const p = c.curriculo_json.perfil;
      
      if (p.regiao) regioesCount[p.regiao] = (regioesCount[p.regiao] || 0) + 1;
      if (p.areaAtuacao) atuacaoCount[p.areaAtuacao] = (atuacaoCount[p.areaAtuacao] || 0) + 1;
      if (p.motivacao) {
        const shortMotiv = p.motivacao.split(':')[0]; // Use prefix for better display
        motivacaoCount[shortMotiv] = (motivacaoCount[shortMotiv] || 0) + 1;
      }
      if (p.visaoFuturo) {
        const shortVisao = p.visaoFuturo.split(':')[0];
        visaoCount[shortVisao] = (visaoCount[shortVisao] || 0) + 1;
      }

      if (p.autoAvalFundamentos) {
        totalFundamentos += Number(p.autoAvalFundamentos);
        totalNageWaza += Number(p.autoAvalNageWaza || 0);
        totalKatameWaza += Number(p.autoAvalKatameWaza || 0);
        totalKata += Number(p.autoAvalKata || 0);
        countAval++;
      }
    });

    const formatData = (obj: Record<string, number>) => Object.entries(obj).map(([name, value]) => ({ name, value }));

    const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

    return {
      regioes: formatData(regioesCount),
      atuacao: formatData(atuacaoCount),
      motivacao: formatData(motivacaoCount),
      visao: formatData(visaoCount),
      autoAval: countAval > 0 ? [
        { name: 'Fundamentos', valor: Number((totalFundamentos / countAval).toFixed(2)) },
        { name: 'Nage-waza', valor: Number((totalNageWaza / countAval).toFixed(2)) },
        { name: 'Katame-waza', valor: Number((totalKatameWaza / countAval).toFixed(2)) },
        { name: 'Kata', valor: Number((totalKata / countAval).toFixed(2)) },
      ] : [],
      COLORS
    };
  };

  const dashboardData = aggregateData();

  if (candidatos.length === 0) {
    return <div className="p-8 text-center text-slate-500">Nenhum dado de perfil disponível para gerar o dashboard.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Regiao e Area de Atuacao */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-red-600" /> Distribuição Regional
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.regioes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {dashboardData.regioes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={dashboardData.COLORS[index % dashboardData.COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <Target className="w-4 h-4 text-red-600" /> Principal Área de Atuação
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={dashboardData.atuacao} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} barSize={20} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motivacao e Visao */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <Lightbulb className="w-4 h-4 text-red-600" /> Motivação para a Graduação
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={dashboardData.motivacao}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-red-600" /> Visão de Futuro e Expectativas
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.visao}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                >
                  {dashboardData.visao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={dashboardData.COLORS[(index + 3) % dashboardData.COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Autoavaliação Técnica */}
      <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-8 flex items-center gap-2 uppercase tracking-wider">
          <Star className="w-4 h-4 text-red-600" /> Médias de Autoavaliação Técnica (1-5)
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReBarChart data={dashboardData.autoAval} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
              />
              <Bar dataKey="valor" fill="#dc2626" radius={[8, 8, 0, 0]} barSize={60}>
                {dashboardData.autoAval.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={dashboardData.COLORS[index % dashboardData.COLORS.length]} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {dashboardData.autoAval.map((item, index) => (
            <div key={item.name} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.name}</div>
              <div className="text-2xl font-black text-slate-800">{item.valor}</div>
              <div className="flex justify-center mt-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= Math.round(item.valor) ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
