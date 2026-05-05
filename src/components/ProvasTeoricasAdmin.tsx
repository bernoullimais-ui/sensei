import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Calendar, Clock, AlertCircle, CheckSquare, FileText, Edit } from 'lucide-react';
import { ActionModal } from './ActionModal';

interface ProvasTeoricasAdminProps {
  loggedUser: any;
}

export function ProvasTeoricasAdmin({ loggedUser }: ProvasTeoricasAdminProps) {
  const [provas, setProvas] = useState<any[]>([]);
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProvaId, setEditingProvaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('60');
  const [selectedQuestoes, setSelectedQuestoes] = useState<Set<string>>(new Set());

  // Modal states
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    inputLabel?: string;
    onConfirm: (val?: any) => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [provasRes, questoesRes] = await Promise.all([
        supabase.from('provas_teoricas').select('*').eq('organizacao_id', loggedUser?.organizacao_id).order('created_at', { ascending: false }),
        supabase.from('questoes_teoricas').select('*').eq('organizacao_id', loggedUser?.organizacao_id).order('created_at', { ascending: false })
      ]);

      if (provasRes.error && provasRes.error.code !== '42P01') throw provasRes.error;
      if (questoesRes.error && questoesRes.error.code !== '42P01') throw questoesRes.error;

      setProvas(provasRes.data || []);
      setQuestoes(questoesRes.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados:', err);
      if (err.code !== '42P01') {
        setError('Não foi possível carregar os dados.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedQuestoes.size === 0) {
      setError('Selecione pelo menos uma questão para a prova.');
      return;
    }

    try {
      const inicioIso = new Date(`${dataInicio}T${horaInicio}:00`).toISOString();
      const fimIso = new Date(`${dataFim}T${horaFim}:00`).toISOString();

      let provaId = editingProvaId;

      if (editingProvaId) {
        // Update existing prova
        const { error: provaError } = await supabase.from('provas_teoricas').update({
          titulo,
          data_inicio: inicioIso,
          data_fim: fimIso,
          duracao_minutos: parseInt(duracaoMinutos)
        }).eq('id', editingProvaId);

        if (provaError) throw provaError;

        // Delete existing questions
        const { error: deleteError } = await supabase.from('prova_questoes').delete().eq('prova_id', editingProvaId);
        if (deleteError) throw deleteError;

        // Update local state
        setProvas(provas.map(p => p.id === editingProvaId ? {
          ...p,
          titulo,
          data_inicio: inicioIso,
          data_fim: fimIso,
          duracao_minutos: parseInt(duracaoMinutos)
        } : p));

      } else {
        // Insert new prova
        const { data: newProva, error: provaError } = await supabase.from('provas_teoricas').insert([{
          titulo,
          data_inicio: inicioIso,
          data_fim: fimIso,
          duracao_minutos: parseInt(duracaoMinutos),
          organizacao_id: loggedUser?.organizacao_id
        }]).select();

        if (provaError) throw provaError;
        if (!newProva || !newProva[0]) throw new Error('Erro ao criar prova.');
        
        provaId = newProva[0].id;
        setProvas([newProva[0], ...provas]);
      }

      if (provaId) {
        const questoesParaInserir = Array.from(selectedQuestoes).map((qId, index) => ({
          prova_id: provaId,
          questao_id: qId,
          ordem: index + 1,
          organizacao_id: loggedUser?.organizacao_id
        }));

        const { error: relError } = await supabase.from('prova_questoes').insert(questoesParaInserir);
        if (relError) throw relError;

        setIsAdding(false);
        setEditingProvaId(null);
        
        // Reset form
        setTitulo('');
        setDataInicio('');
        setHoraInicio('');
        setDataFim('');
        setHoraFim('');
        setDuracaoMinutos('60');
        setSelectedQuestoes(new Set());
      }
    } catch (err: any) {
      console.error('Erro ao salvar prova:', err);
      setError('Erro ao salvar a prova. Verifique se as tabelas foram criadas.');
    }
  };

  const handleEditClick = async (prova: any) => {
    setTitulo(prova.titulo);
    
    const dInicio = new Date(prova.data_inicio);
    setDataInicio(dInicio.toISOString().split('T')[0]);
    setHoraInicio(dInicio.toTimeString().substring(0, 5));
    
    const dFim = new Date(prova.data_fim);
    setDataFim(dFim.toISOString().split('T')[0]);
    setHoraFim(dFim.toTimeString().substring(0, 5));
    
    setDuracaoMinutos(prova.duracao_minutos.toString());
    setEditingProvaId(prova.id);
    setIsAdding(true);
    setError(null);

    try {
      const { data, error } = await supabase.from('prova_questoes').select('questao_id').eq('prova_id', prova.id);
      if (error) throw error;
      
      const qIds = new Set(data?.map(d => d.questao_id) || []);
      setSelectedQuestoes(qIds);
    } catch (err) {
      console.error('Erro ao buscar questões da prova:', err);
    }
  };

  const handleDelete = async (id: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Prova',
      message: 'Tem certeza que deseja excluir esta prova? As respostas dos candidatos também serão perdidas.',
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('provas_teoricas').delete().eq('id', id);
          if (error) throw error;
          setProvas(provas.filter(p => p.id !== id));
        } catch (err: any) {
          console.error('Erro ao excluir:', err);
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Erro ao excluir a prova.',
            onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const toggleQuestao = (id: string) => {
    const newSelected = new Set(selectedQuestoes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestoes(newSelected);
  };

  const handleSortearQuestoes = () => {
    setModalConfig({
      isOpen: true,
      type: 'prompt',
      title: 'Sortear Questões',
      message: `Quantas questões você deseja sortear? (Máximo: ${questoes.length})`,
      onConfirm: (value: string) => {
        const qtd = parseInt(value || '');
        if (isNaN(qtd) || qtd <= 0) {
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'Erro',
            message: 'Quantidade inválida.',
            onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
          });
          return;
        }
        
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        const maxQtd = Math.min(qtd, questoes.length);
        const shuffled = [...questoes].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, maxQtd).map(q => q.id);
        
        setSelectedQuestoes(new Set(selected));
      }
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-red-600" /> Gerenciar Provas Teóricas
        </h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Prova
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Criar Nova Prova</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Título da Prova</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Exame Teórico Faixa Preta 2026"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início (Data e Hora)</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  required
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                />
                <input 
                  type="time" 
                  required
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                  className="w-32 p-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fim (Data e Hora)</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  required
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                />
                <input 
                  type="time" 
                  required
                  value={horaFim}
                  onChange={e => setHoraFim(e.target.value)}
                  className="w-32 p-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração (minutos)</label>
              <input 
                type="number" 
                required
                min="1"
                value={duracaoMinutos}
                onChange={e => setDuracaoMinutos(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-slate-700 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Selecionar Questões ({selectedQuestoes.size} selecionadas)
              </h4>
              <button
                type="button"
                onClick={handleSortearQuestoes}
                disabled={questoes.length === 0}
                className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
              >
                Sortear Questões
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-md bg-white">
              {questoes.length === 0 ? (
                <p className="p-4 text-center text-slate-500 text-sm">Nenhuma questão cadastrada no banco.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {questoes.map(q => (
                    <li key={q.id} className="p-3 hover:bg-slate-50 flex items-start gap-3">
                      <input 
                        type="checkbox" 
                        className="mt-1 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                        checked={selectedQuestoes.has(q.id)}
                        onChange={() => toggleQuestao(q.id)}
                      />
                      <div className="flex-1 cursor-pointer" onClick={() => toggleQuestao(q.id)}>
                        <p className="text-sm font-medium text-slate-800">{q.texto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => {
                setIsAdding(false);
                setEditingProvaId(null);
                setTitulo('');
                setDataInicio('');
                setHoraInicio('');
                setDataFim('');
                setHoraFim('');
                setDuracaoMinutos('60');
                setSelectedQuestoes(new Set());
              }} 
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">
              {editingProvaId ? 'Atualizar Prova' : 'Criar Prova'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Carregando provas...</div>
      ) : provas.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Nenhuma prova cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {provas.map(p => (
            <div key={p.id} className="border border-slate-200 rounded-lg p-4 hover:border-red-300 transition-colors bg-white shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 mb-3">{p.titulo}</h3>
              
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Início: {new Date(p.data_inicio).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Fim: {new Date(p.data_fim).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Duração: {p.duracao_minutos} min</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-3 mt-auto">
                <button 
                  onClick={() => handleEditClick(p)}
                  className="text-sm flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <Edit className="w-4 h-4" /> Editar
                </button>
                <button 
                  onClick={() => handleDelete(p.id)}
                  className="text-sm flex items-center gap-1 text-slate-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <ActionModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
