import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Upload, Download, AlertCircle, HelpCircle, Search } from 'lucide-react';

export function BancoQuestoes() {
  const [questoes, setQuestoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState('');

  // Form state
  const [texto, setTexto] = useState('');
  const [opcaoA, setOpcaoA] = useState('');
  const [opcaoB, setOpcaoB] = useState('');
  const [opcaoC, setOpcaoC] = useState('');
  const [opcaoD, setOpcaoD] = useState('');
  const [opcaoE, setOpcaoE] = useState('');
  const [gabarito, setGabarito] = useState('A');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);
  const [isAlert, setIsAlert] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchQuestoes();
  }, []);

  const fetchQuestoes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('questoes_teoricas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setQuestoes(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar questões:', err);
      if (err.code !== '42P01') {
        setError('Não foi possível carregar as questões.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const { data: newQuestao, error } = await supabase.from('questoes_teoricas').insert([{
        texto,
        opcao_a: opcaoA,
        opcao_b: opcaoB,
        opcao_c: opcaoC,
        opcao_d: opcaoD,
        opcao_e: opcaoE,
        gabarito
      }]).select();

      if (error) throw error;

      if (newQuestao) {
        setQuestoes([newQuestao[0], ...questoes]);
        setIsAdding(false);
        setTexto('');
        setOpcaoA('');
        setOpcaoB('');
        setOpcaoC('');
        setOpcaoD('');
        setOpcaoE('');
        setGabarito('A');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar:', err);
      setError('Erro ao salvar a questão. Verifique se a tabela foi criada.');
    }
  };

  const handleDelete = async (id: string) => {
    setModalMessage('Tem certeza que deseja excluir esta questão?');
    setIsAlert(false);
    setModalAction(() => async () => {
      try {
        const { error } = await supabase.from('questoes_teoricas').delete().eq('id', id);
        if (error) throw error;
        setQuestoes(questoes.filter(q => q.id !== id));
      } catch (err: any) {
        console.error('Erro ao excluir:', err);
        setModalMessage('Erro ao excluir a questão.');
        setIsAlert(true);
        setModalOpen(true);
      }
    });
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setModalMessage('O arquivo CSV parece estar vazio ou não tem cabeçalho.');
          setIsAlert(true);
          setModalOpen(true);
          return;
        }

        const headerLine = lines[0];
        const separator = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(separator).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        
        const idxTexto = headers.findIndex(h => h === 'texto' || h === 'pergunta');
        const idxA = headers.findIndex(h => h === 'opcao_a' || h === 'a');
        const idxB = headers.findIndex(h => h === 'opcao_b' || h === 'b');
        const idxC = headers.findIndex(h => h === 'opcao_c' || h === 'c');
        const idxD = headers.findIndex(h => h === 'opcao_d' || h === 'd');
        const idxE = headers.findIndex(h => h === 'opcao_e' || h === 'e');
        const idxGab = headers.findIndex(h => h === 'gabarito' || h === 'resposta');

        if (idxTexto === -1 || idxA === -1 || idxGab === -1) {
          setModalMessage('Cabeçalho inválido. Certifique-se de que as colunas texto, opcao_a, opcao_b, opcao_c, opcao_d, opcao_e e gabarito existam.');
          setIsAlert(true);
          setModalOpen(true);
          return;
        }

        const novasQuestoes = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const values = line.split(regex).map(v => v.replace(/^"|"$/g, '').trim());
          
          if (values.length >= 7) {
            const txt = values[idxTexto];
            const gab = values[idxGab]?.toUpperCase();
            
            if (!txt || !['A','B','C','D','E'].includes(gab)) continue;
            
            novasQuestoes.push({
              texto: txt,
              opcao_a: values[idxA] || '',
              opcao_b: values[idxB] || '',
              opcao_c: values[idxC] || '',
              opcao_d: values[idxD] || '',
              opcao_e: values[idxE] || '',
              gabarito: gab
            });
          }
        }

        if (novasQuestoes.length > 0) {
          const { data: insertedData, error } = await supabase.from('questoes_teoricas').insert(novasQuestoes).select();
          if (error) throw error;
          
          if (insertedData) {
            setQuestoes([...insertedData, ...questoes]);
            setModalMessage(`${insertedData.length} questões importadas com sucesso!`);
            setIsAlert(true);
            setModalOpen(true);
          }
        } else {
          setModalMessage('Nenhum dado válido encontrado para importar.');
          setIsAlert(true);
          setModalOpen(true);
        }
      } catch (err: any) {
        console.error('Erro ao importar CSV:', err);
        setModalMessage('Erro ao importar o arquivo CSV. Verifique o formato e se a tabela existe.');
        setIsAlert(true);
        setModalOpen(true);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ['texto', 'opcao_a', 'opcao_b', 'opcao_c', 'opcao_d', 'opcao_e', 'gabarito'];
    const example = ['Qual a tradução de Judô?', 'Caminho Suave', 'Caminho Duro', 'Arte da Espada', 'Caminho do Punho', 'Arte Suave', 'A'];
    
    const csvContent = [
      headers.join(','),
      example.map(e => `"${e}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_questoes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredQuestoes = questoes.filter(q => 
    filtroTexto === '' || q.texto.toLowerCase().includes(filtroTexto.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-red-600" /> Banco de Questões
        </h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Modelo CSV
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Importar CSV
          </button>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar Manual
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Nova Questão</h3>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pergunta</label>
              <textarea 
                required
                value={texto}
                onChange={e => setTexto(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opção A</label>
                <input type="text" required value={opcaoA} onChange={e => setOpcaoA(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opção B</label>
                <input type="text" required value={opcaoB} onChange={e => setOpcaoB(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opção C</label>
                <input type="text" required value={opcaoC} onChange={e => setOpcaoC(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opção D</label>
                <input type="text" required value={opcaoD} onChange={e => setOpcaoD(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Opção E</label>
                <input type="text" required value={opcaoE} onChange={e => setOpcaoE(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Gabarito (Resposta Correta)</label>
                <select required value={gabarito} onChange={e => setGabarito(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-sm font-bold">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">Salvar Questão</button>
          </div>
        </form>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Pesquisar questões..." 
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Carregando questões...</div>
      ) : filteredQuestoes.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Nenhuma questão encontrada.</div>
      ) : (
        <div className="space-y-4">
          {filteredQuestoes.map((q, i) => (
            <div key={q.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-800 mb-3"><span className="text-slate-400 mr-2">#{i + 1}</span>{q.texto}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className={`p-2 rounded ${q.gabarito === 'A' ? 'bg-green-100 text-green-800 font-medium border border-green-200' : 'bg-slate-50 text-slate-600'}`}>A) {q.opcao_a}</div>
                    <div className={`p-2 rounded ${q.gabarito === 'B' ? 'bg-green-100 text-green-800 font-medium border border-green-200' : 'bg-slate-50 text-slate-600'}`}>B) {q.opcao_b}</div>
                    <div className={`p-2 rounded ${q.gabarito === 'C' ? 'bg-green-100 text-green-800 font-medium border border-green-200' : 'bg-slate-50 text-slate-600'}`}>C) {q.opcao_c}</div>
                    <div className={`p-2 rounded ${q.gabarito === 'D' ? 'bg-green-100 text-green-800 font-medium border border-green-200' : 'bg-slate-50 text-slate-600'}`}>D) {q.opcao_d}</div>
                    <div className={`p-2 rounded ${q.gabarito === 'E' ? 'bg-green-100 text-green-800 font-medium border border-green-200' : 'bg-slate-50 text-slate-600'}`}>E) {q.opcao_e}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(q.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle className={`w-6 h-6 ${isAlert ? 'text-red-500' : 'text-blue-500'}`} />
              {isAlert ? 'Atenção' : 'Confirmação'}
            </h3>
            <p className="text-slate-600 mb-6">{modalMessage}</p>
            <div className="flex justify-end gap-3">
              {!isAlert && (
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  setModalOpen(false);
                  if (modalAction) modalAction();
                }}
                className={`px-4 py-2 text-white rounded-md font-medium transition-colors ${
                  isAlert ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
