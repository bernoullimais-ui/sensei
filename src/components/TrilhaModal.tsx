import React, { useState, useEffect } from 'react';
import { X, Plus, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function TrilhaModal({ isOpen, onClose, fetchTrilhas, editingTrilha }: { isOpen: boolean, onClose: () => void, fetchTrilhas: () => void, editingTrilha?: any }) {
  const [activeTab, setActiveTab] = useState<'geral' | 'conteudos' | 'participantes' | 'engajamento'>('geral');
  const [nome, setNome] = useState(editingTrilha?.nome || '');
  const [preco, setPreco] = useState(editingTrilha?.preco || 0);
  const [emBreve, setEmBreve] = useState(editingTrilha?.em_breve || false);
  const [capaUrl, setCapaUrl] = useState(editingTrilha?.capa_url || '');
  const [coordenadorNome, setCoordenadorNome] = useState(editingTrilha?.coordenador_nome || '');
  const [coordenadorTitulo, setCoordenadorTitulo] = useState(editingTrilha?.coordenador_titulo || '');
  const [coordenadorFotoUrl, setCoordenadorFotoUrl] = useState(editingTrilha?.coordenador_foto_url || '');
  const [listaProfessores, setListaProfessores] = useState<{nome: string, titulo: string}[]>([]);
  const [descricao, setDescricao] = useState(editingTrilha?.descricao || '');
  const [cursosDisponiveis, setCursosDisponiveis] = useState<any[]>([]);
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const { data: cursos } = await supabase.from('cursos').select('id, nome');
        const sortedCursos = (cursos || []).sort((a, b) => a.nome.localeCompare(b.nome));
        setCursosDisponiveis(sortedCursos);
        
        if (editingTrilha) {
            setNome(editingTrilha.nome || '');
            setPreco(editingTrilha.preco || 0);
            setEmBreve(editingTrilha.em_breve || false);
            setCapaUrl(editingTrilha.capa_url || '');
            setCoordenadorNome(editingTrilha.coordenador_nome || '');
            setCoordenadorTitulo(editingTrilha.coordenador_titulo || '');
            setCoordenadorFotoUrl(editingTrilha.coordenador_foto_url || '');
            
            // Tenta carregar do JSON novo, se não existir, tenta converter o texto antigo
            if (editingTrilha.professores_extra_json && Array.isArray(editingTrilha.professores_extra_json) && editingTrilha.professores_extra_json.length > 0) {
              setListaProfessores(editingTrilha.professores_extra_json);
            } else if (editingTrilha.professores_convidados) {
              setListaProfessores([{ 
                nome: editingTrilha.professores_convidados, 
                titulo: editingTrilha.professores_titulos || '' 
              }]);
            } else {
              setListaProfessores([{ nome: '', titulo: '' }]);
            }

            setDescricao(editingTrilha.descricao || '');
            const { data: trilhaCursos } = await supabase.from('trilha_cursos').select('curso_id').eq('trilha_id', editingTrilha.id);
            setCursosSelecionados(trilhaCursos?.map(c => c.curso_id) || []);
        } else {
            setNome('');
            setPreco(0);
            setEmBreve(false);
            setCapaUrl('');
            setCoordenadorNome('');
            setCoordenadorTitulo('');
            setCoordenadorFotoUrl('');
            setListaProfessores([{ nome: '', titulo: '' }]);
            setDescricao('');
            setCursosSelecionados([]);
        }
    };
    fetchData();
  }, [isOpen, editingTrilha]);

  if (!isOpen) return null;

  const handleAddProfessor = () => {
    setListaProfessores([...listaProfessores, { nome: '', titulo: '' }]);
  };

  const handleRemoveProfessor = (index: number) => {
    const newList = [...listaProfessores];
    newList.splice(index, 1);
    setListaProfessores(newList.length > 0 ? newList : [{ nome: '', titulo: '' }]);
  };

  const handleProfessorChange = (index: number, field: 'nome' | 'titulo', value: string) => {
    const newList = [...listaProfessores];
    newList[index][field] = value;
    setListaProfessores(newList);
  };

  const handleSave = async () => {
    // Filtra professores vazios
    const profsValidos = listaProfessores.filter(p => p.nome.trim() !== '');
    
    // Para manter compatibilidade com colunas de texto antigas (pega o primeiro ou join)
    const profPrincipal = profsValidos[0]?.nome || '';
    const tituloPrincipal = profsValidos[0]?.titulo || '';

    let trilhaId = editingTrilha?.id;
    let error;

    const trilhaData = { 
        nome, 
        preco, 
        em_breve: emBreve,
        capa_url: capaUrl, 
        coordenador_nome: coordenadorNome, 
        coordenador_titulo: coordenadorTitulo,
        coordenador_foto_url: coordenadorFotoUrl,
        professores_convidados: profPrincipal, 
        professores_titulos: tituloPrincipal,
        professores_extra_json: profsValidos, // Salva a lista completa aqui
        descricao, 
        status: 'Rascunho'
    };

    if (trilhaId) {
        const { error: updateError } = await supabase.from('trilhas').update(trilhaData).eq('id', trilhaId);
        error = updateError;
    } else {
        const { data: trilha, error: insertError } = await supabase.from('trilhas').insert([trilhaData]).select().single();
        trilhaId = trilha?.id;
        error = insertError;
    }

    if (error) {
        console.error('Erro ao salvar trilha:', error);
        alert('Erro ao salvar trilha: ' + error.message);
    } else {
        console.log('Trilha salva, salvando cursos:', trilhaId);
        // Remove existing cursos first
        await supabase.from('trilha_cursos').delete().eq('trilha_id', trilhaId);
        
        const { error: cursosError } = await supabase.from('trilha_cursos').insert(cursosSelecionados.map(curso_id => ({ trilha_id: trilhaId, curso_id })));                
        if (cursosError) {
          console.error('Erro ao salvar cursos da trilha:', cursosError);
          alert('Erro ao salvar cursos da trilha: ' + cursosError.message);
        } else {
          fetchTrilhas();
          onClose();
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">{editingTrilha ? 'Editar Trilha' : 'Criar Trilha'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><X /></button>
        </div>
        <div className="flex border-b border-slate-200">
           {(['geral', 'conteudos', 'participantes', 'engajamento'] as const).map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 font-semibold capitalize ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}>
                {tab === 'geral' ? 'Visão Geral' : tab}
             </button>
           ))}
        </div>
        <div className="p-8 overflow-y-auto flex-1">
          {activeTab === 'geral' && (
             <div className="space-y-4">
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da trilha" className="w-full p-3 border rounded-lg"/>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Preço (R$)</label>
                    <input type="number" value={preco} onChange={e => setPreco(parseFloat(e.target.value))} placeholder="Preço" className="w-full p-3 border rounded-lg"/>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input 
                      type="checkbox" 
                      id="emBreve" 
                      checked={emBreve} 
                      onChange={e => setEmBreve(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="emBreve" className="font-medium text-slate-700">Marcar como "Em Breve"</label>
                  </div>
                </div>
                <input value={capaUrl} onChange={e => setCapaUrl(e.target.value)} placeholder="URL da Imagem da capa" className="w-full p-3 border rounded-lg"/>
                <div className="flex gap-4">
                  <input value={coordenadorNome} onChange={e => setCoordenadorNome(e.target.value)} placeholder="Coordenador da trilha" className="flex-1 p-3 border rounded-lg"/>
                  <input value={coordenadorTitulo} onChange={e => setCoordenadorTitulo(e.target.value)} placeholder="Título do coordenador" className="flex-1 p-3 border rounded-lg"/>
                </div>
                <input value={coordenadorFotoUrl} onChange={e => setCoordenadorFotoUrl(e.target.value)} placeholder="URL da Foto do Coordenador" className="w-full p-3 border rounded-lg"/>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Professores Convidados</label>
                    <button 
                      type="button"
                      onClick={handleAddProfessor}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Professor
                    </button>
                  </div>
                  
                  {listaProfessores.map((prof, index) => (
                    <div key={index} className="flex gap-4 items-start bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                      <input 
                        value={prof.nome} 
                        onChange={e => handleProfessorChange(index, 'nome', e.target.value)} 
                        placeholder="Nome do professor" 
                        className="flex-1 p-3 border rounded-lg bg-white"
                      />
                      <input 
                        value={prof.titulo} 
                        onChange={e => handleProfessorChange(index, 'titulo', e.target.value)} 
                        placeholder="Título / Faixa" 
                        className="flex-1 p-3 border rounded-lg bg-white"
                      />
                      {listaProfessores.length > 1 && (
                        <button 
                          onClick={() => handleRemoveProfessor(index)} 
                          className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-white transition-colors"
                          title="Remover professor"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição da trilha" className="w-full p-3 border rounded-lg" rows={4}/>
             </div>
          )}
          {activeTab === 'conteudos' && (
            <div className="space-y-2">
                {cursosDisponiveis.map(curso => (
                    <label key={curso.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={cursosSelecionados.includes(curso.id)} onChange={e => {
                            if (e.target.checked) setCursosSelecionados([...cursosSelecionados, curso.id]);
                            else setCursosSelecionados(cursosSelecionados.filter(id => id !== curso.id));
                        }}/>
                        {curso.nome}
                    </label>
                ))}
            </div>
          )}
          {activeTab === 'participantes' && <div className="p-4 bg-slate-50 text-slate-500 text-center rounded">Participantes da trilha e desempenho</div>}
          {activeTab === 'engajamento' && <div className="p-4 bg-slate-50 text-slate-500 text-center rounded">Configuração de certificado</div>}
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"><Save className="w-4 h-4"/> Salvar</button>
        </div>
      </div>
    </div>
  );
}
