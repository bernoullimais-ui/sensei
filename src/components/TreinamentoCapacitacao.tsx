import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { addToSyncQueue } from '../lib/offlineSync';
import { ActionModal } from './ActionModal';
import { 
  Users, BookOpen, CheckCircle, AlertTriangle, 
  Plus, Trash2, ChevronRight, Save, Edit, Trophy,
  Activity, ArrowLeft, PlayCircle, BarChart2,
  XCircle, Upload, Download, Link as LinkIcon, Copy, X
} from 'lucide-react';

interface TreinamentoCapacitacaoProps {
  loggedUser: any;
  loggedRole: string;
}

export function TreinamentoCapacitacao({ loggedUser, loggedRole }: TreinamentoCapacitacaoProps) {
  const [treinamentos, setTreinamentos] = useState<any[]>([]);
  const [selectedTreinamento, setSelectedTreinamento] = useState<any>(null);
  const [view, setView] = useState('list'); // list, detail, execution
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<any>({ isOpen: false, type: 'alert', title: '' });

  const isAdmin = loggedRole === 'admin' || (loggedRole === 'avaliador' && ('funcao' in loggedUser) && (loggedUser.funcao === 'gestor' || loggedUser.funcao === 'coordenador'));

  useEffect(() => {
    fetchTreinamentos();

    // Subscribe to real-time updates for all treinamentos
    const channel = supabase
      .channel('public:treinamentos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'treinamentos'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setTreinamentos(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
            
            // Also update selectedTreinamento if it's the one being modified
            setSelectedTreinamento(prev => prev && prev.id === payload.new.id ? { ...prev, ...payload.new } : prev);
          } else if (payload.eventType === 'INSERT') {
            setTreinamentos(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setTreinamentos(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTreinamentos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('treinamentos').select('*').eq('organizacao_id', loggedUser?.organizacao_id).order('created_at', { ascending: false });
      if (error) {
        // Se a tabela não existir, não quebra, apenas mostra vazio
        if (error.code === '42P01') {
          setTreinamentos([]);
          setError('As tabelas de treinamento ainda não foram criadas no banco de dados. Por favor, execute o script SQL fornecido.');
        } else {
          throw error;
        }
      } else {
        setTreinamentos(data || []);
      }
    } catch (err: any) {
      console.error('Erro ao buscar treinamentos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTreinamento = async () => {
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Novo Treinamento',
      inputLabel: 'Nome do novo treinamento:',
      onConfirm: async (nome: string) => {
        setModalConfig({ isOpen: false });
        if (!nome) return;

        try {
          const { data, error } = await supabase.from('treinamentos').insert([{
            nome,
            data: new Date().toISOString().split('T')[0],
            status: 'configuracao',
            organizacao_id: loggedUser?.organizacao_id
          }]).select();

          if (error) throw error;
          if (data) {
            setTreinamentos([data[0], ...treinamentos]);
            setSelectedTreinamento(data[0]);
            setView('detail');
          }
        } catch (err: any) {
          console.error('Erro ao criar treinamento:', err);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao criar treinamento. Verifique se as tabelas foram criadas.',
            onConfirm: () => setModalConfig({ isOpen: false })
          });
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleEditTreinamento = async (treinamento: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the detail view
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Editar Treinamento',
      inputLabel: 'Novo nome do treinamento:',
      initialValue: treinamento.nome,
      onConfirm: async (nome: string) => {
        setModalConfig({ isOpen: false });
        if (!nome || nome === treinamento.nome) return;

        try {
          const { error } = await supabase.from('treinamentos').update({ nome }).eq('id', treinamento.id);
          if (error) throw error;
          // Optimistic update (subscription will also catch this)
          setTreinamentos(prev => prev.map(t => t.id === treinamento.id ? { ...t, nome } : t));
        } catch (err) {
          console.error('Erro ao editar treinamento:', err);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao editar treinamento. Tente novamente.',
            onConfirm: () => setModalConfig({ isOpen: false })
          });
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleDeleteTreinamento = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Treinamento',
      message: 'Tem certeza que deseja excluir este treinamento? Esta ação não pode ser desfeita e removerá todos os dados associados.',
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.from('treinamentos').delete().eq('id', id);
          if (error) throw error;
          setTreinamentos(prev => prev.filter(t => t.id !== id));
        } catch (err) {
          console.error('Erro ao excluir treinamento:', err);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao excluir treinamento. Tente novamente.',
            onConfirm: () => setModalConfig({ isOpen: false })
          });
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando módulo de treinamento...</div>;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="bg-red-50 text-red-700 p-4 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold mb-1">Atenção Necessária</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      {view === 'list' && (
        <>
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-red-600" /> Treinamento e Capacitação
            </h2>
            {isAdmin && (
              <button 
                onClick={handleCreateTreinamento}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo Treinamento
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {treinamentos.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                Nenhum treinamento cadastrado.
              </div>
            ) : (
              treinamentos.map(treinamento => (
                <div 
                  key={treinamento.id} 
                  className="border border-slate-200 rounded-lg p-5 hover:border-red-300 hover:shadow-md transition-all cursor-pointer bg-slate-50 relative group"
                  onClick={() => {
                    setSelectedTreinamento(treinamento);
                    setView('detail');
                  }}
                >
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleEditTreinamento(treinamento, e)}
                        className="p-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded shadow-sm border border-slate-200"
                        title="Editar Treinamento"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteTreinamento(treinamento.id, e)}
                        className="p-1.5 bg-white text-red-600 hover:bg-red-50 rounded shadow-sm border border-slate-200"
                        title="Excluir Treinamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3 pr-16">
                    <h3 className="font-bold text-slate-800 text-lg">{treinamento.nome}</h3>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      treinamento.status === 'configuracao' ? 'bg-slate-200 text-slate-700' :
                      treinamento.status === 'fase1' ? 'bg-blue-100 text-blue-800' :
                      treinamento.status === 'fase2' ? 'bg-purple-100 text-purple-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {treinamento.status === 'configuracao' ? 'Configuração' :
                       treinamento.status === 'fase1' ? 'Fase 1 (Prática)' :
                       treinamento.status === 'fase2' ? 'Fase 2 (Avaliação)' : 'Concluído'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2 mt-3">
                    <Activity className="w-4 h-4" /> Data: {new Date(treinamento.data).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {view === 'detail' && selectedTreinamento && (
        <TreinamentoDetail 
          treinamento={selectedTreinamento} 
          onBack={() => {
            setView('list');
            fetchTreinamentos();
          }}
          isAdmin={isAdmin}
          loggedUser={loggedUser}
        />
      )}

      <ActionModal {...modalConfig} />
    </div>
  );
}

// Sub-component for Training Details
function TreinamentoDetail({ treinamento, onBack, isAdmin, loggedUser }: any) {
  const [activeTab, setActiveTab] = useState('participantes');
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [tecnicas, setTecnicas] = useState<any[]>([]);
  const [allTecnicas, setAllTecnicas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(treinamento.status);
  const [modalConfig, setModalConfig] = useState<any>({ isOpen: false, type: 'alert', title: '' });

  useEffect(() => {
    fetchDetails();

    // Subscribe to real-time status updates
    const channel = supabase
      .channel(`treinamento_status_${treinamento.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'treinamentos',
          filter: `id=eq.${treinamento.id}`
        },
        (payload) => {
          if (payload.new && payload.new.status) {
            setCurrentStatus(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [treinamento.id]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const [partRes, tecRes, allTecRes] = await Promise.all([
        supabase.from('treinamento_participantes').select('*').eq('treinamento_id', treinamento.id).order('nome'),
        supabase.from('treinamento_tecnicas').select('*').eq('treinamento_id', treinamento.id).order('fase').order('ordem'),
        supabase.from('tecnicas').select('*').eq('organizacao_id', loggedUser?.organizacao_id).order('nome')
      ]);

      if (partRes.data) setParticipantes(partRes.data);
      if (tecRes.data) setTecnicas(tecRes.data);
      if (allTecRes.data) setAllTecnicas(allTecRes.data);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const changeStatus = async (newStatus: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Mudar Status',
      message: `Mudar status para ${newStatus}?`,
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.from('treinamentos').update({ status: newStatus }).eq('id', treinamento.id);
          if (error) throw error;
          setCurrentStatus(newStatus);
        } catch (err) {
          console.error('Erro ao mudar status:', err);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao mudar status.',
            onConfirm: () => setModalConfig({ isOpen: false })
          });
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleAddParticipante = async () => {
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Novo Participante',
      inputLabel: 'Nome do participante (Avaliador em treinamento):',
      checkboxLabel: 'Este participante é um Coordenador (Gabarito)?',
      onConfirm: async (nome: string, isCoordenador: boolean) => {
        setModalConfig({ isOpen: false });
        if (!nome) return;

        try {
          const { data, error } = await supabase.from('treinamento_participantes').insert([{
            treinamento_id: treinamento.id,
            nome,
            is_coordenador: isCoordenador,
            organizacao_id: treinamento.organizacao_id
          }]).select();

          if (error) throw error;
          if (data) setParticipantes([...participantes, data[0]]);
        } catch (err) {
          console.error('Erro ao adicionar participante:', err);
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleRemoveParticipante = async (id: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Remover Participante',
      message: 'Tem certeza que deseja remover este participante?',
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.from('treinamento_participantes').delete().eq('id', id);
          if (error) throw error;
          setParticipantes(participantes.filter(p => p.id !== id));
        } catch (err) {
          console.error('Erro ao remover participante:', err);
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) return;

      const newParticipantes = [];
      for (let i = 0; i < lines.length; i++) {
        // Skip header if it looks like one
        if (i === 0 && (lines[i].toLowerCase().includes('nome') || lines[i].toLowerCase().includes('zempo'))) continue;

        const parts = lines[i].split(/[,;]/).map(p => p.trim());
        
        // Expected format: ZEMPO, NOME, DOJO, COORDENADOR
        const zempo = parts[0] || '';
        const nome = parts[1] || '';
        const dojo = parts[2] || '';
        const coordStr = parts[3] || '';

        if (!nome) continue;

        let isCoordenador = false;
        if (coordStr) {
          const lowerCoord = coordStr.toLowerCase();
          isCoordenador = lowerCoord === 'sim' || lowerCoord === 'true' || lowerCoord === '1';
        }

        newParticipantes.push({
          treinamento_id: treinamento.id,
          zempo,
          nome,
          dojo,
          is_coordenador: isCoordenador,
          organizacao_id: treinamento.organizacao_id
        });
      }

      if (newParticipantes.length === 0) {
        setModalConfig({
          isOpen: true,
          type: 'alert',
          title: 'Erro',
          message: 'Nenhum participante válido encontrado no arquivo.',
          onConfirm: () => setModalConfig({ isOpen: false })
        });
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase.from('treinamento_participantes').insert(newParticipantes).select();
        if (error) throw error;
        if (data) {
          setParticipantes([...participantes, ...data]);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Sucesso',
            message: `${data.length} participantes importados com sucesso.`,
            onConfirm: () => setModalConfig({ isOpen: false })
          });
        }
      } catch (err) {
        console.error('Erro ao importar participantes:', err);
        setModalConfig({
          isOpen: true,
          type: 'alert',
          title: 'Erro',
          message: 'Erro ao importar participantes. Verifique o formato do arquivo.',
          onConfirm: () => setModalConfig({ isOpen: false })
        });
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const downloadCSVTemplate = () => {
    const csvContent = 'ZEMPO,NOME,DOJO,COORDENADOR\n12345,João Silva,Dojo Central,não\n67890,Maria Souza,Dojo Norte,sim\n11111,Carlos Pereira,Dojo Sul,\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_participantes_treinamento.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTecnica = async (fase: number) => {
    setModalConfig({
      isOpen: true,
      type: 'multiselect',
      title: `Adicionar Técnicas - Fase ${fase}`,
      inputLabel: 'Selecione as técnicas:',
      options: allTecnicas.map(t => ({ label: `${t.nome} (${t.grupo})`, value: t.nome })),
      onConfirm: async (nomes: string[]) => {
        setModalConfig({ isOpen: false });
        if (!nomes || nomes.length === 0) return;

        const faseTecnicas = tecnicas.filter(t => t.fase === fase);
        const startOrdem = faseTecnicas.length + 1;

        const newTecnicas = nomes.map((nome, index) => ({
          treinamento_id: treinamento.id,
          nome,
          fase,
          ordem: startOrdem + index,
          organizacao_id: treinamento.organizacao_id
        }));

        try {
          const { data, error } = await supabase.from('treinamento_tecnicas').insert(newTecnicas).select();

          if (error) throw error;
          if (data) setTecnicas([...tecnicas, ...data]);
        } catch (err) {
          console.error('Erro ao adicionar técnicas:', err);
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const handleRemoveTecnica = async (id: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Remover Técnica',
      message: 'Tem certeza que deseja remover esta técnica?',
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.from('treinamento_tecnicas').delete().eq('id', id);
          if (error) throw error;
          setTecnicas(tecnicas.filter(t => t.id !== id));
        } catch (err) {
          console.error('Erro ao remover técnica:', err);
        }
      },
      onCancel: () => setModalConfig({ isOpen: false })
    });
  };

  const copyAccessLink = async () => {
    const baseUrl = process.env.APP_URL || window.location.origin;
    const url = `${baseUrl}${window.location.pathname}?treinamento=${treinamento.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Link Copiado!',
        message: 'O link de acesso para os participantes foi copiado para a área de transferência.',
        onConfirm: () => setModalConfig({ isOpen: false })
      });
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      // Fallback se o clipboard falhar (comum em iframes)
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Link de Acesso',
        message: `Copie o link abaixo para enviar aos participantes:\n\n${url}`,
        onConfirm: () => setModalConfig({ isOpen: false })
      });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando detalhes...</div>;

  // Se não for admin, mostra a tela de execução (ParticipanteView)
  if (!isAdmin) {
    return <TreinamentoExecution 
      treinamento={{...treinamento, status: currentStatus}} 
      participantes={participantes} 
      tecnicas={tecnicas} 
      onBack={onBack} 
    />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{treinamento.nome}</h2>
            <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
              Status atual: 
              <span className="font-semibold text-slate-700 uppercase">{currentStatus}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={copyAccessLink}
          className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-md font-medium transition-colors border border-red-200"
        >
          <LinkIcon className="w-4 h-4" />
          Copiar Link de Acesso
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setActiveTab('participantes')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'participantes' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Participantes</button>
        <button onClick={() => setActiveTab('tecnicas')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tecnicas' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Técnicas</button>
        <button onClick={() => setActiveTab('controle')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'controle' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Controle de Fases</button>
        <button onClick={() => setActiveTab('gabarito')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'gabarito' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Gabarito (Fase 2)</button>
        <button onClick={() => setActiveTab('resultados')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'resultados' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Resultados</button>
      </div>

      {activeTab === 'participantes' && (
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Participantes do Treinamento</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={downloadCSVTemplate}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors"
                title="Baixar modelo CSV"
              >
                <Download className="w-4 h-4" /> Modelo
              </button>
              <label className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" /> Importar CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleImportCSV} 
                />
              </label>
              <button onClick={handleAddParticipante} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {participantes.map(p => (
              <div key={p.id} className="bg-white p-3 rounded border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-medium text-slate-800">{p.nome}</div>
                  <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-1">
                    {(p.zempo || p.dojo) && (
                      <div className="flex gap-2">
                        {p.zempo && <span><span className="font-semibold">Zempo:</span> {p.zempo}</span>}
                        {p.dojo && <span><span className="font-semibold">Dojo:</span> {p.dojo}</span>}
                      </div>
                    )}
                    <span className={p.is_coordenador ? 'font-semibold text-purple-600' : ''}>
                      {p.is_coordenador ? 'Coordenador (Gabarito)' : 'Avaliador em Treinamento'}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleRemoveParticipante(p.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {participantes.length === 0 && <div className="col-span-full text-slate-500 text-sm py-4">Nenhum participante adicionado.</div>}
          </div>
        </div>
      )}

      {activeTab === 'tecnicas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-blue-900">Fase 1: Estudo (Prática Livre)</h3>
              <button onClick={() => handleAddTecnica(1)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            <p className="text-sm text-blue-700 mb-4">Técnicas para reconhecimento e simulação livre.</p>
            <div className="space-y-2">
              {tecnicas.filter(t => t.fase === 1).map((t, i) => (
                <div key={t.id} className="bg-white p-3 rounded border border-blue-200 flex justify-between items-center shadow-sm">
                  <span className="font-medium text-slate-800">{i + 1}. {t.nome}</span>
                  <button onClick={() => handleRemoveTecnica(t.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {tecnicas.filter(t => t.fase === 1).length === 0 && <div className="text-slate-500 text-sm py-2">Nenhuma técnica adicionada.</div>}
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-purple-900">Fase 2: Avaliação (Gabarito)</h3>
              <button onClick={() => handleAddTecnica(2)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            <p className="text-sm text-purple-700 mb-4">Técnicas (geralmente 10) para avaliação oficial e ranking.</p>
            <div className="space-y-2">
              {tecnicas.filter(t => t.fase === 2).map((t, i) => (
                <div key={t.id} className="bg-white p-3 rounded border border-purple-200 flex justify-between items-center shadow-sm">
                  <span className="font-medium text-slate-800">{i + 1}. {t.nome}</span>
                  <button onClick={() => handleRemoveTecnica(t.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {tecnicas.filter(t => t.fase === 2).length === 0 && <div className="text-slate-500 text-sm py-2">Nenhuma técnica adicionada.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'controle' && (
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 max-w-2xl mx-auto">
          <h3 className="font-bold text-lg mb-6 text-center">Controle de Fases do Treinamento</h3>
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${currentStatus === 'configuracao' ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-slate-200 opacity-60'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">1. Configuração</h4>
                  <p className="text-sm text-slate-500">Adicionando participantes e técnicas.</p>
                </div>
                {currentStatus !== 'configuracao' && (
                  <button onClick={() => changeStatus('configuracao')} className="text-blue-600 text-sm font-medium hover:underline">Reativar</button>
                )}
              </div>
            </div>
            
            <div className={`p-4 rounded-lg border ${currentStatus === 'fase1' ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-slate-200 opacity-60'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">2. Fase 1 (Prática Livre)</h4>
                  <p className="text-sm text-slate-500">Participantes podem acessar e simular avaliações livremente.</p>
                </div>
                {currentStatus !== 'fase1' && (
                  <button onClick={() => changeStatus('fase1')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors">Iniciar Fase 1</button>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${currentStatus === 'fase2' ? 'bg-white border-purple-500 shadow-md ring-1 ring-purple-500' : 'bg-white border-slate-200 opacity-60'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">3. Fase 2 (Avaliação Oficial)</h4>
                  <p className="text-sm text-slate-500">Participantes avaliam as 10 técnicas para comparação com o gabarito.</p>
                </div>
                {currentStatus !== 'fase2' && (
                  <button onClick={() => changeStatus('fase2')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 transition-colors">Iniciar Fase 2</button>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${currentStatus === 'concluido' ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500' : 'bg-white border-slate-200 opacity-60'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">4. Concluído</h4>
                  <p className="text-sm text-slate-500">Treinamento encerrado. Resultados disponíveis.</p>
                </div>
                {currentStatus !== 'concluido' && (
                  <button onClick={() => changeStatus('concluido')} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700 transition-colors">Encerrar Treinamento</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gabarito' && (
        <TreinamentoGabarito treinamento={treinamento} tecnicas={tecnicas.filter(t => t.fase === 2)} participantes={participantes} />
      )}

      {activeTab === 'resultados' && (
        <TreinamentoResultados treinamento={treinamento} tecnicas={tecnicas.filter(t => t.fase === 2)} participantes={participantes} />
      )}

      <ActionModal {...modalConfig} />
    </div>
  );
}

// Sub-component for Coordinator to set Gabarito
function TreinamentoGabarito({ treinamento, tecnicas, participantes }: any) {
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTecnica, setActiveTecnica] = useState<any>(null);
  const [activeCriterioTab, setActiveCriterioTab] = useState<'desequilibrio' | 'preparacao' | 'execucao'>('desequilibrio');
  const [localAvaliacao, setLocalAvaliacao] = useState<any>({ desequilibrio: null, preparacao: null, execucao: null });
  
  const coordenador = participantes.find((p: any) => p.is_coordenador);

  useEffect(() => {
    if (coordenador) fetchGabarito();
    else setIsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTecnica) {
      const existing = avaliacoes.find(a => a.tecnica_id === activeTecnica.id);
      if (existing && existing.desequilibrio && existing.preparacao && existing.execucao) {
        setLocalAvaliacao({
          desequilibrio: existing.desequilibrio,
          preparacao: existing.preparacao,
          execucao: existing.execucao
        });
      } else if (existing) {
        setLocalAvaliacao({
          desequilibrio: existing.desequilibrio || null,
          preparacao: existing.preparacao || null,
          execucao: existing.execucao || null
        });
      } else {
        setLocalAvaliacao({ desequilibrio: null, preparacao: null, execucao: null });
      }
      setActiveCriterioTab('desequilibrio');
    }
  }, [activeTecnica, avaliacoes]);

  const fetchGabarito = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('treinamento_avaliacoes')
        .select('*')
        .eq('treinamento_id', treinamento.id)
        .eq('participante_id', coordenador.id)
        .eq('is_gabarito', true);
      
      if (error) throw error;
      if (data) setAvaliacoes(data);
    } catch (err) {
      console.error('Erro ao buscar gabarito:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isAlreadyEvaluated = avaliacoes.some(a => a.tecnica_id === activeTecnica?.id && a.desequilibrio && a.preparacao && a.execucao);

  const handleSetCriterio = async (criterio: string, value: string | null) => {
    if (!coordenador || !activeTecnica || isAlreadyEvaluated) return;

    setLocalAvaliacao((prev: any) => ({ ...prev, [criterio]: value }));

    // Auto-advance to next tab if a value was selected
    if (value !== null) {
      setTimeout(() => {
        if (criterio === 'desequilibrio') {
          setActiveCriterioTab('preparacao');
        } else if (criterio === 'preparacao') {
          setActiveCriterioTab('execucao');
        }
      }, 300);
    }
  };

  const handleSaveAvaliacao = async () => {
    if (!coordenador || !activeTecnica || isAlreadyEvaluated) return;
    if (!localAvaliacao.desequilibrio || !localAvaliacao.preparacao || !localAvaliacao.execucao) return;

    try {
      const existing = avaliacoes.find(a => a.tecnica_id === activeTecnica.id);
      
      const payload = {
        treinamento_id: treinamento.id,
        tecnica_id: activeTecnica.id,
        participante_id: coordenador.id,
        is_gabarito: true,
        desequilibrio: localAvaliacao.desequilibrio,
        preparacao: localAvaliacao.preparacao,
        execucao: localAvaliacao.execucao,
        organizacao_id: treinamento.organizacao_id
      };

      if (!navigator.onLine) {
        // Offline save
        const tempId = existing ? existing.id : crypto.randomUUID();
        const offlineData = { id: tempId, ...payload };
        
        addToSyncQueue({
          type: 'treinamento_avaliacao',
          payload: offlineData
        });
        
        if (existing) {
          setAvaliacoes(prev => prev.map(a => a.id === existing.id ? offlineData : a));
        } else {
          setAvaliacoes([...avaliacoes, offlineData]);
        }
        // alert('Salvo offline. Sincronizará quando houver conexão.');
      } else {
        if (existing) {
          const { data, error } = await supabase
            .from('treinamento_avaliacoes')
            .update({
              desequilibrio: localAvaliacao.desequilibrio,
              preparacao: localAvaliacao.preparacao,
              execucao: localAvaliacao.execucao
            })
            .eq('id', existing.id)
            .select();
          if (error) throw error;
          if (data) setAvaliacoes(prev => prev.map(a => a.id === existing.id ? data[0] : a));
        } else {
          const { data, error } = await supabase
            .from('treinamento_avaliacoes')
            .insert([payload]).select();
          if (error) throw error;
          if (data) setAvaliacoes([...avaliacoes, data[0]]);
        }
      }

      // Move to next technique or close
      const currentIndex = tecnicas.findIndex((t: any) => t.id === activeTecnica.id);
      if (currentIndex < tecnicas.length - 1) {
        setActiveTecnica(tecnicas[currentIndex + 1]);
      } else {
        setActiveTecnica(null);
      }
    } catch (err: any) {
      console.error('Erro ao salvar gabarito:', err);
      alert('Erro ao salvar: ' + (err.message || 'Erro desconhecido. Verifique o console.'));
      fetchGabarito();
    }
  };

  if (!coordenador) {
    return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">Nenhum coordenador definido nos participantes para registrar o gabarito.</div>;
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando gabarito...</div>;

  if (activeTecnica) {
    const currentIndex = tecnicas.findIndex((t: any) => t.id === activeTecnica.id);
    const totalTecnicas = tecnicas.length;
    const isComplete = localAvaliacao.desequilibrio && localAvaliacao.preparacao && localAvaliacao.execucao;

    const handleNext = () => {
      if (currentIndex < totalTecnicas - 1) {
        setActiveTecnica(tecnicas[currentIndex + 1]);
        setActiveCriterioTab('desequilibrio');
      } else {
        setActiveTecnica(null);
      }
    };

    const handlePrev = () => {
      if (currentIndex > 0) {
        setActiveTecnica(tecnicas[currentIndex - 1]);
        setActiveCriterioTab('desequilibrio');
      }
    };

    const tabs = [
      { id: 'desequilibrio', label: 'KUZUSHI', title: 'Defina o Gabarito para Kuzushi (Desequilíbrio)' },
      { id: 'preparacao', label: 'TSUKURI', title: 'Defina o Gabarito para Tsukuri (Preparação)' },
      { id: 'execucao', label: 'KAKE', title: 'Defina o Gabarito para Kake (Execução)' }
    ] as const;

    const options = [
      { value: 'realizada', label: 'Realizada' },
      { value: 'parcialmente', label: 'Parcialmente Realizada' },
      { value: 'nao_realizada', label: 'Não Realizada' }
    ];

    const currentTabInfo = tabs.find(t => t.id === activeCriterioTab)!;

    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-4">
        {/* Header */}
        <header className="bg-slate-900 text-white p-4 flex flex-col relative">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Gabarito Oficial</div>
                <div className="text-sm font-bold">{coordenador.nome}</div>
              </div>
            </div>
            <button 
              onClick={() => setActiveTecnica(null)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="text-center mt-6 mb-4">
            <h2 className="text-3xl font-black tracking-tight uppercase">{activeTecnica.nome}</h2>
            <div className="text-xs text-slate-400 mt-2 font-medium tracking-widest">
              TÉCNICA {currentIndex + 1} DE {totalTecnicas}
            </div>
            <div className="text-sm font-bold mt-4 text-slate-200">
              FASE 2
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCriterioTab(tab.id)}
                  className={`flex-1 py-4 text-sm font-bold tracking-wider transition-colors ${
                    activeCriterioTab === tab.id 
                      ? 'text-blue-600 border-t-2 border-t-blue-600 bg-white' 
                      : 'text-slate-400 border-t-2 border-t-transparent bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 flex-1 flex flex-col justify-center">
              <h3 className="text-center text-lg font-bold text-slate-800 mb-8">
                {currentTabInfo.title}
              </h3>
              
              <div className="space-y-4 max-w-md mx-auto w-full">
                {options.map(opt => {
                  const isSelected = localAvaliacao[activeCriterioTab] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      disabled={isAlreadyEvaluated}
                      onClick={() => handleSetCriterio(activeCriterioTab, isSelected ? null : opt.value)}
                      className={`w-full p-4 rounded-lg border-2 text-center font-semibold transition-all ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      } ${isAlreadyEvaluated ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-6 py-2.5 rounded-lg font-medium text-slate-600 bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
          >
            Anterior
          </button>
          
          <div className="flex items-center gap-2">
            {tecnicas.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2.5 h-2.5 rounded-full ${idx === currentIndex ? 'bg-blue-600' : 'bg-slate-300'}`}
              />
            ))}
          </div>

          {isAlreadyEvaluated ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900 transition-colors"
            >
              {currentIndex === totalTecnicas - 1 ? 'Concluir' : 'Próxima'}
            </button>
          ) : (
            <button
              onClick={handleSaveAvaliacao}
              disabled={!isComplete}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Salvar Avaliação
            </button>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
      <div className="mb-6">
        <h3 className="font-bold text-lg text-slate-800">Gabarito Oficial (Fase 2)</h3>
        <p className="text-sm text-slate-500">Coordenador responsável: <strong>{coordenador.nome}</strong></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tecnicas.map((t: any, i: number) => {
          const isEvaluated = avaliacoes.some(a => a.tecnica_id === t.id && a.desequilibrio && a.preparacao && a.execucao);
          
          return (
            <button
              key={t.id}
              onClick={() => setActiveTecnica(t)}
              className={`p-5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[120px] ${
                isEvaluated 
                  ? 'bg-blue-50 border-blue-200 hover:border-blue-300' 
                  : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-slate-400 mb-1 block">Técnica {i + 1}</span>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{t.nome}</h3>
              </div>
              <div className="mt-4 flex justify-between items-center w-full">
                {isEvaluated ? (
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Gabarito Definido</span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Pendente</span>
                )}
                <PlayCircle className={`w-6 h-6 ${isEvaluated ? 'text-blue-400' : 'text-slate-300'}`} />
              </div>
            </button>
          );
        })}
        {tecnicas.length === 0 && <div className="text-slate-500 text-center py-4 col-span-full">Nenhuma técnica cadastrada para a Fase 2.</div>}
      </div>
    </div>
  );
}

// Sub-component for Results and Ranking
function TreinamentoResultados({ treinamento, tecnicas, participantes }: any) {
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAvaliacoes();
  }, []);

  const fetchAvaliacoes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('treinamento_avaliacoes')
        .select('*')
        .eq('treinamento_id', treinamento.id);
      
      if (error) throw error;
      if (data) setAvaliacoes(data);
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Calculando resultados...</div>;

  const gabaritos = avaliacoes.filter(a => a.is_gabarito);
  const avaliadores = participantes.filter((p: any) => !p.is_coordenador);

  // Calcular aproveitamento
  const ranking = avaliadores.map((avaliador: any) => {
    // Only consider evaluations for Phase 2 techniques
    const phase2TecnicaIds = tecnicas.map((t: any) => t.id);
    const avsAvaliador = avaliacoes.filter(a => a.participante_id === avaliador.id && phase2TecnicaIds.includes(a.tecnica_id));
    let totalCriterios = 0;
    let acertos = 0;

    tecnicas.forEach((t: any) => {
      const gab = gabaritos.find(g => g.tecnica_id === t.id);
      const av = avsAvaliador.find(a => a.tecnica_id === t.id);

      if (gab && av) {
        totalCriterios += 3;
        if (gab.desequilibrio === av.desequilibrio) acertos++;
        if (gab.preparacao === av.preparacao) acertos++;
        if (gab.execucao === av.execucao) acertos++;
      }
    });

    const aproveitamento = totalCriterios > 0 ? Math.round((acertos / totalCriterios) * 100) : 0;
    const tecnicasAvaliadas = avsAvaliador.length;

    return {
      ...avaliador,
      aproveitamento,
      tecnicasAvaliadas,
      acertos,
      totalCriterios
    };
  }).sort((a, b) => b.aproveitamento - a.aproveitamento);

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-8 h-8 text-amber-500" />
        <div>
          <h3 className="font-bold text-xl text-slate-800">Ranking de Aproveitamento</h3>
          <p className="text-sm text-slate-500">Comparação das avaliações da Fase 2 com o Gabarito Oficial.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200">
              <th className="p-4 font-semibold w-16 text-center">Pos</th>
              <th className="p-4 font-semibold">Avaliador</th>
              <th className="p-4 font-semibold text-center">Técnicas Avaliadas</th>
              <th className="p-4 font-semibold text-center">Acertos (Critérios)</th>
              <th className="p-4 font-semibold text-right">Aproveitamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ranking.map((r, index) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-center font-bold text-slate-400">
                  {index === 0 ? <span className="text-amber-500 text-lg">1º</span> :
                   index === 1 ? <span className="text-slate-400 text-lg">2º</span> :
                   index === 2 ? <span className="text-amber-700 text-lg">3º</span> :
                   `${index + 1}º`}
                </td>
                <td className="p-4 font-medium text-slate-800">{r.nome}</td>
                <td className="p-4 text-center text-slate-600">{r.tecnicasAvaliadas} / {tecnicas.length}</td>
                <td className="p-4 text-center text-slate-600">{r.acertos} / {r.totalCriterios || (tecnicas.length * 3)}</td>
                <td className="p-4 text-right font-bold text-slate-800">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    r.aproveitamento >= 80 ? 'bg-emerald-100 text-emerald-800' :
                    r.aproveitamento >= 60 ? 'bg-blue-100 text-blue-800' :
                    r.aproveitamento >= 40 ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {r.aproveitamento}%
                  </span>
                </td>
              </tr>
            ))}
            {ranking.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum dado de avaliação disponível.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sub-component for Participant Execution
export function TreinamentoExecution({ treinamento, participantes, tecnicas, onBack, loggedParticipant }: any) {
  const [activeParticipant, setActiveParticipant] = useState<any>(loggedParticipant || null);
  const [activeTecnica, setActiveTecnica] = useState<any>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [activeCriterioTab, setActiveCriterioTab] = useState<'desequilibrio' | 'preparacao' | 'execucao'>('desequilibrio');
  const [localAvaliacao, setLocalAvaliacao] = useState<any>({ desequilibrio: null, preparacao: null, execucao: null });

  const faseAtual = treinamento.status === 'fase1' ? 1 : treinamento.status === 'fase2' ? 2 : 0;
  const tecnicasFase = tecnicas.filter((t: any) => t.fase === faseAtual);

  useEffect(() => {
    // Reset active technique when phase changes to redirect users synchronously
    setActiveTecnica(null);
  }, [faseAtual]);

  useEffect(() => {
    if (activeParticipant) fetchMinhasAvaliacoes();
  }, [activeParticipant]);

  useEffect(() => {
    if (activeTecnica) {
      const existing = avaliacoes.find(a => a.tecnica_id === activeTecnica.id);
      if (existing && existing.desequilibrio && existing.preparacao && existing.execucao) {
        setLocalAvaliacao({
          desequilibrio: existing.desequilibrio,
          preparacao: existing.preparacao,
          execucao: existing.execucao
        });
      } else if (existing) {
        setLocalAvaliacao({
          desequilibrio: existing.desequilibrio || null,
          preparacao: existing.preparacao || null,
          execucao: existing.execucao || null
        });
      } else {
        setLocalAvaliacao({ desequilibrio: null, preparacao: null, execucao: null });
      }
      setActiveCriterioTab('desequilibrio');
    }
  }, [activeTecnica, avaliacoes]);

  const fetchMinhasAvaliacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('treinamento_avaliacoes')
        .select('*')
        .eq('treinamento_id', treinamento.id)
        .eq('participante_id', activeParticipant.id);
      
      if (!error && data) setAvaliacoes(data);
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    }
  };

  const isAlreadyEvaluated = avaliacoes.some(a => a.tecnica_id === activeTecnica?.id && a.desequilibrio && a.preparacao && a.execucao);

  const handleSetCriterio = async (criterio: string, value: string | null) => {
    if (!activeParticipant || !activeTecnica || isAlreadyEvaluated) return;

    setLocalAvaliacao((prev: any) => ({ ...prev, [criterio]: value }));

    // Auto-advance to next tab if a value was selected
    if (value !== null) {
      setTimeout(() => {
        if (criterio === 'desequilibrio') {
          setActiveCriterioTab('preparacao');
        } else if (criterio === 'preparacao') {
          setActiveCriterioTab('execucao');
        }
      }, 300);
    }
  };

  const handleSaveAvaliacao = async () => {
    if (!activeParticipant || !activeTecnica || isAlreadyEvaluated) return;
    if (!localAvaliacao.desequilibrio || !localAvaliacao.preparacao || !localAvaliacao.execucao) return;

    try {
      const existing = avaliacoes.find(a => a.tecnica_id === activeTecnica.id);

      const payload = {
        treinamento_id: treinamento.id,
        tecnica_id: activeTecnica.id,
        participante_id: activeParticipant.id,
        is_gabarito: false,
        desequilibrio: localAvaliacao.desequilibrio,
        preparacao: localAvaliacao.preparacao,
        execucao: localAvaliacao.execucao,
        organizacao_id: treinamento.organizacao_id
      };

      if (!navigator.onLine) {
        // Offline save
        const tempId = existing ? existing.id : crypto.randomUUID();
        const offlineData = { id: tempId, ...payload };
        
        addToSyncQueue({
          type: 'treinamento_avaliacao',
          payload: offlineData
        });
        
        if (existing) {
          setAvaliacoes(prev => prev.map(a => a.id === existing.id ? offlineData : a));
        } else {
          setAvaliacoes([...avaliacoes, offlineData]);
        }
        // alert('Salvo offline. Sincronizará quando houver conexão.');
      } else {
        if (existing) {
          const { data, error } = await supabase
            .from('treinamento_avaliacoes')
            .update({
              desequilibrio: localAvaliacao.desequilibrio,
              preparacao: localAvaliacao.preparacao,
              execucao: localAvaliacao.execucao
            })
            .eq('id', existing.id)
            .select();
          if (error) throw error;
          if (data) setAvaliacoes(prev => prev.map(a => a.id === existing.id ? data[0] : a));
        } else {
          const { data, error } = await supabase
            .from('treinamento_avaliacoes')
            .insert([payload]).select();
          if (error) throw error;
          if (data) setAvaliacoes([...avaliacoes, data[0]]);
        }
      }

      // Move to next technique or close
      const currentIndex = tecnicasFase.findIndex((t: any) => t.id === activeTecnica.id);
      if (currentIndex < tecnicasFase.length - 1) {
        setActiveTecnica(tecnicasFase[currentIndex + 1]);
      } else {
        setActiveTecnica(null);
      }
    } catch (err: any) {
      console.error('Erro ao salvar avaliação:', err);
      alert('Erro ao salvar: ' + (err.message || 'Erro desconhecido. Verifique o console.'));
      fetchMinhasAvaliacoes();
    }
  };

  if (!activeParticipant) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6 border-b pb-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{treinamento.nome}</h2>
            <p className="text-sm text-slate-500">Selecione seu nome para iniciar o treinamento</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {participantes.filter((p: any) => !p.is_coordenador).map((p: any) => (
            <button
              key={p.id}
              onClick={() => setActiveParticipant(p)}
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors text-left flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                {p.nome.charAt(0)}
              </div>
              <span className="font-medium text-slate-800">{p.nome}</span>
            </button>
          ))}
          {participantes.filter((p: any) => !p.is_coordenador).length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-500">Nenhum participante cadastrado neste treinamento.</div>
          )}
        </div>
      </div>
    );
  }

  if (faseAtual === 0) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{treinamento.nome}</h2>
            <p className="text-sm text-slate-500">Avaliador: <strong>{activeParticipant.nome}</strong></p>
          </div>
        </div>
        <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Treinamento não está ativo</h3>
          <p>Aguarde o coordenador iniciar a Fase 1 ou Fase 2.</p>
        </div>
      </div>
    );
  }

  if (activeTecnica) {
    const currentIndex = tecnicasFase.findIndex((t: any) => t.id === activeTecnica.id);
    const totalTecnicas = tecnicasFase.length;
    const isComplete = localAvaliacao.desequilibrio && localAvaliacao.preparacao && localAvaliacao.execucao;

    const handleNext = () => {
      if (currentIndex < totalTecnicas - 1) {
        setActiveTecnica(tecnicasFase[currentIndex + 1]);
        setActiveCriterioTab('desequilibrio');
      } else {
        setActiveTecnica(null);
      }
    };

    const handlePrev = () => {
      if (currentIndex > 0) {
        setActiveTecnica(tecnicasFase[currentIndex - 1]);
        setActiveCriterioTab('desequilibrio');
      }
    };

    const tabs = [
      { id: 'desequilibrio', label: 'KUZUSHI', title: 'Avalie o Kuzushi (Desequilíbrio)' },
      { id: 'preparacao', label: 'TSUKURI', title: 'Avalie o Tsukuri (Preparação)' },
      { id: 'execucao', label: 'KAKE', title: 'Avalie o Kake (Execução)' }
    ] as const;

    const options = [
      { value: 'realizada', label: 'Realizada' },
      { value: 'parcialmente', label: 'Parcialmente Realizada' },
      { value: 'nao_realizada', label: 'Não Realizada' }
    ];

    const currentTabInfo = tabs.find(t => t.id === activeCriterioTab)!;

    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col animate-in slide-in-from-bottom-4">
        {/* Header */}
        <header className="bg-slate-900 text-white p-4 flex flex-col relative">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Avaliador</div>
                <div className="text-sm font-bold">{activeParticipant.nome}</div>
              </div>
            </div>
            <button 
              onClick={() => setActiveTecnica(null)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="text-center mt-6 mb-4">
            <h2 className="text-3xl font-black tracking-tight uppercase">{activeTecnica.nome}</h2>
            <div className="text-xs text-slate-400 mt-2 font-medium tracking-widest">
              TÉCNICA {currentIndex + 1} DE {totalTecnicas}
            </div>
            <div className="text-sm font-bold mt-4 text-slate-200">
              FASE {faseAtual}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCriterioTab(tab.id)}
                  className={`flex-1 py-4 text-sm font-bold tracking-wider transition-colors ${
                    activeCriterioTab === tab.id 
                      ? 'text-red-600 border-t-2 border-t-red-600 bg-white' 
                      : 'text-slate-400 border-t-2 border-t-transparent bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 flex-1 flex flex-col justify-center">
              <h3 className="text-center text-lg font-bold text-slate-800 mb-8">
                {currentTabInfo.title}
              </h3>
              
              <div className="space-y-4 max-w-md mx-auto w-full">
                {options.map(opt => {
                  const isSelected = localAvaliacao[activeCriterioTab] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      disabled={isAlreadyEvaluated}
                      onClick={() => handleSetCriterio(activeCriterioTab, isSelected ? null : opt.value)}
                      className={`w-full p-4 rounded-lg border-2 text-center font-semibold transition-all ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      } ${isAlreadyEvaluated ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-6 py-2.5 rounded-lg font-medium text-slate-600 bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
          >
            Anterior
          </button>
          
          <div className="flex items-center gap-2">
            {tecnicasFase.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2.5 h-2.5 rounded-full ${idx === currentIndex ? 'bg-red-600' : 'bg-slate-300'}`}
              />
            ))}
          </div>

          {isAlreadyEvaluated ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900 transition-colors"
            >
              {currentIndex === totalTecnicas - 1 ? 'Concluir' : 'Próxima'}
            </button>
          ) : (
            <button
              onClick={handleSaveAvaliacao}
              disabled={!isComplete}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Salvar Avaliação
            </button>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{treinamento.nome}</h2>
          <p className="text-sm text-slate-500">
            Avaliador: <strong>{activeParticipant.nome}</strong> • 
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${faseAtual === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
              Fase {faseAtual}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tecnicasFase.map((t: any, i: number) => {
          const isEvaluated = avaliacoes.some(a => a.tecnica_id === t.id && a.desequilibrio && a.preparacao && a.execucao);
          
          return (
            <button
              key={t.id}
              onClick={() => setActiveTecnica(t)}
              className={`p-5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[120px] ${
                isEvaluated 
                  ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' 
                  : 'bg-white border-slate-200 hover:border-red-300 hover:shadow-md'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-slate-400 mb-1 block">Técnica {i + 1}</span>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{t.nome}</h3>
              </div>
              <div className="mt-4 flex justify-between items-center w-full">
                {isEvaluated ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Avaliada</span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Pendente</span>
                )}
                <PlayCircle className={`w-6 h-6 ${isEvaluated ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
            </button>
          );
        })}
        {tecnicasFase.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
            Nenhuma técnica cadastrada para esta fase.
          </div>
        )}
      </div>
    </div>
  );
}
