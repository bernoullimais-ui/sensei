import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, CheckCircle2, XCircle, FileDown, ArrowLeft, Users, ClipboardCheck, RefreshCw, Award, Download } from 'lucide-react';
import { generateCertificatePDF } from '../lib/certificateUtils';

interface Modulo {
  id: string;
  nome?: string;
  tema: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  local: string;
  regiao: string;
  organizacao_id: string;
  certificado_template?: any;
  carga_horaria?: string;
}

interface Participant {
  id: string;
  candidato_id: string;
  presente: boolean;
  candidato: {
    nome: string;
    email: string;
  };
  role?: string;
}

export function FrequenciaModulo({ 
  moduloId, 
  onBack, 
  showToast,
  onRefresh
}: { 
  moduloId: string, 
  onBack: () => void, 
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void,
  onRefresh?: () => void
}) {
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [moduloId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch modulo details
      const { data: modData, error: modErr } = await supabase
        .from('modulos_avaliacao')
        .select('*')
        .eq('id', moduloId)
        .single();
      
      if (modErr) throw modErr;
      setModulo(modData);

      // 2. Fetch participants
      const { data: partData, error: partErr } = await supabase
        .from('modulo_participantes')
        .select(`
          id,
          candidato_id,
          presente,
          candidato:candidatos(id, nome, grau_pretendido)
        `)
        .eq('modulo_id', moduloId);

      if (partErr) throw partErr;

      // 3. To get the 'role' and 'email', fetch from usuarios table
      const candidatoIds = partData ? partData.map((p: any) => p.candidato_id).filter(Boolean) : [];
      
      let userData: any[] = [];
      if (candidatoIds.length > 0) {
        const { data, error: userErr } = await supabase
          .from('usuarios')
          .select('reference_id, role, email, tipo_inscricao, nome')
          .in('reference_id', candidatoIds);
        
        if (data) userData = data;
      }

      const userMapByRef = new Map();
      userData.forEach(u => {
        if (u.reference_id) userMapByRef.set(u.reference_id, u);
      });

      const mappedParticipants = partData.map((p: any) => {
        const userInfo = userMapByRef.get(p.candidato_id);
        // Identify as ouvinte if role is specifically 'ouvinte' OR if they registered specifically for a modulo
        const isOuvinte = userInfo?.role === 'ouvinte' || userInfo?.tipo_inscricao === 'modulo' || p.candidato?.grau_pretendido === 'Iniciante';
        
        return {
          id: p.id,
          candidato_id: p.candidato_id,
          presente: p.presente,
          candidato: {
            id: p.candidato?.id || p.candidato_id,
            nome: p.candidato?.nome || userInfo?.nome || 'Inscrito Desconhecido',
            email: userInfo?.email || ''
          },
          role: isOuvinte ? 'ouvinte' : 'candidato'
        };
      });

      // Sort by name
      mappedParticipants.sort((a, b) => (a.candidato?.nome || '').localeCompare(b.candidato?.nome || ''));
      setParticipants(mappedParticipants);

    } catch (err) {
      console.error('Error fetching frequency data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCertificate = async (p: Participant) => {
    if (!modulo?.certificado_template) {
      if (showToast) showToast('Nenhum template de certificado configurado para este módulo.', 'error');
      return;
    }
    
    try {
      if (showToast) showToast('Gerando certificado...', 'info');
      await generateCertificatePDF(modulo.certificado_template as any, {
        id: p.id,
        nome: p.candidato.nome,
        dataConclusao: new Date(modulo.data).toLocaleDateString('pt-BR'),
        titulo: modulo.nome || modulo.tema,
        cargaHoraria: modulo.carga_horaria
      });
    } catch (err) {
      console.error('Error generating certificate:', err);
      if (showToast) showToast('Erro ao gerar certificado.', 'error');
    }
  };

  const togglePresence = async (partId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('modulo_participantes')
        .update({ presente: !currentStatus })
        .eq('id', partId);

      if (error) throw error;

      setParticipants(prev => prev.map(p => 
        p.id === partId ? { ...p, presente: !currentStatus } : p
      ));
    } catch (err) {
      console.error('Error updating presence:', err);
    }
  };

  const syncParticipants = async () => {
    if (!modulo) return;
    setIsSyncing(true);
    try {
      // 1. Fetch all candidates of the org
      const { data: orgCands, error: candErr } = await supabase
        .from('candidatos')
        .select('id, nome')
        .eq('organizacao_id', modulo.organizacao_id);

      if (candErr) throw candErr;

      // 2. Fetch all users who should be in this module:
      // A. Standard candidates from the organization
      // B. Professional listeners from the organization
      // C. Anyone already in modulo_participantes (important to keep public registrants)
      
      // Get org users who are listeners
      const { data: orgUsers } = await supabase
        .from('usuarios')
        .select('id, nome, reference_id, email')
        .eq('organizacao_id', modulo.organizacao_id)
        .eq('role', 'ouvinte');
      
      const listenerRefIds: string[] = [];
      
      if (orgUsers) {
        for (const user of orgUsers) {
          if (user.reference_id) {
            listenerRefIds.push(user.reference_id);
          } else {
            // Repair: create a candidate record for ouvintes that don't have one
            try {
              const { data: newCand, error: newCandErr } = await supabase
                .from('candidatos')
                .insert([{
                  nome: user.nome,
                  organizacao_id: modulo.organizacao_id,
                  grau_pretendido: 'Iniciante'
                }])
                .select().single();
              
              if (newCand) {
                await supabase.from('usuarios').update({ reference_id: newCand.id }).eq('id', user.id);
                listenerRefIds.push(newCand.id);
              }
            } catch (err) {
              console.error('Error repairing listener reference:', err);
            }
          }
        }
      }

      // Get existing registrants already in this module (public link)
      const { data: existingParts } = await supabase
        .from('modulo_participantes')
        .select('candidato_id')
        .eq('modulo_id', moduloId);
      
      const existingPartIds = existingParts ? existingParts.map(p => p.candidato_id).filter(Boolean) : [];

      // Combine all unique IDs
      const allCandIds = new Set([
        ...(orgCands?.map(c => c.id) || []),
        ...listenerRefIds,
        ...existingPartIds
      ]);

      if (allCandIds.size > 0) {
        // Prepare all for upsert
        const allParticipants = Array.from(allCandIds).map(id => ({
          modulo_id: moduloId,
          candidato_id: id,
          presente: true
        }));

        // Use upsert to overwrite existing ones and add new ones
        const { error: upsertErr } = await supabase
          .from('modulo_participantes')
          .upsert(allParticipants, { onConflict: 'modulo_id,candidato_id' });
        
        if (upsertErr) throw upsertErr;
        
        showToast ? showToast('Participantes (candidatos e ouvintes) sincronizados.', 'success') : alert('Participantes sincronizados.');
        
        if (onRefresh) onRefresh();

        // 3. Refresh data
        await fetchData();
      } else {
        showToast ? showToast('Nenhum candidato ou ouvinte encontrado para importar.', 'info') : alert('Nenhum candidato ou ouvinte encontrado.');
      }
    } catch (err) {
      console.error('Error syncing candidates:', err);
      showToast ? showToast('Erro ao sincronizar participantes.', 'error') : alert('Erro ao sincronizar participantes.');
    } finally {
      setIsSyncing(false);
    }
  };

  const exportCSV = () => {
    setIsExporting(true);
    try {
      const header = ['Nome', 'E-mail', 'Tipo', 'Presença', 'Assinatura'];
      const rows = participants.map(p => [
        p.candidato.nome,
        p.candidato.email,
        p.role === 'ouvinte' ? 'Ouvinte' : 'Candidato',
        p.presente ? 'Presente' : 'Ausente',
        '' // Signature column
      ]);

      const csvContent = [
        [`Relatório de Frequência - ${modulo?.nome || modulo?.tema}`],
        [`Data: ${modulo?.data.split('-').reverse().join('/')} | Horário: ${modulo?.horario_inicio} - ${modulo?.horario_fim}`],
        [`Local: ${modulo?.local} (${modulo?.regiao})`],
        [],
        header,
        ...rows
      ].map(r => r.join(';')).join('\n');

      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `frequencia_${moduloId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Carregando lista de frequência...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase tracking-wider mb-1">
              <ClipboardCheck className="w-4 h-4" /> Registro de Frequência
            </div>
            <h2 className="text-2xl font-black text-slate-800">{modulo?.nome || modulo?.tema}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={syncParticipants}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border ${
                isSyncing 
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Atualizando...' : 'Atualizar Lista'}
            </button>
            <button 
              onClick={exportCSV}
              disabled={participants.length === 0 || isExporting}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-bold block text-slate-400 mb-1">Data</span>
            {modulo?.data.split('-').reverse().join('/')}
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-bold block text-slate-400 mb-1">Horário</span>
            {modulo?.horario_inicio} às {modulo?.horario_fim}
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-bold block text-slate-400 mb-1">Local</span>
            {modulo?.local} ({modulo?.regiao})
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" /> 
            Participantes Inscritos ({participants.length})
            <button 
              onClick={syncParticipants}
              disabled={isSyncing}
              className={`p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 transition-colors ${isSyncing ? 'cursor-not-allowed opacity-50' : ''}`}
              title="Sincronizar novos candidatos da organização"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </h3>
          <div className="text-sm font-medium text-slate-500">
            {participants.filter(p => p.presente).length} presentes / {participants.length} total
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum participante inscrito neste módulo.</p>
            <p className="text-xs text-slate-400 mt-1 mb-6">Inscrições realizadas através do link público aparecerão aqui ou você pode importar automaticamente.</p>
            <button 
              onClick={syncParticipants}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-lg text-sm font-bold border border-slate-300 hover:bg-slate-50 hover:border-red-300 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Atualizando Lista...' : 'Importar Todos os Candidatos da Organização'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-100">
                  <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider pl-2">Participante</th>
                  <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider">Tipo</th>
                  <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-center">Frequência</th>
                  <th className="pb-4 font-bold text-slate-400 text-xs uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {participants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 pl-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 group-hover:text-red-700 transition-colors">{p.candidato.nome}</span>
                        <span className="text-xs text-slate-400">{p.candidato.email}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        p.role === 'ouvinte' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {p.role === 'ouvinte' ? 'OUVINTE' : 'CANDIDATO'}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button 
                        onClick={() => togglePresence(p.id, p.presente)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${
                          p.presente 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {p.presente ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Presente
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Ausente
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {p.presente && (
                          <button 
                            onClick={() => handleDownloadCertificate(p)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                            title="Download Certificado"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
        <p className="text-xs text-slate-400">
          * Por padrão, todos os inscritos são marcados como presentes. Desmarque os ausentes manualmentes.
        </p>
      </div>
    </div>
  );
}
