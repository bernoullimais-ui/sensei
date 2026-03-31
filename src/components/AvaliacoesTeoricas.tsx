import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Trash2, Upload, Download, AlertCircle } from 'lucide-react';

export function AvaliacoesTeoricas() {
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [candidatoId, setCandidatoId] = useState('');
  const [grauPretendido, setGrauPretendido] = useState('Shodan (1º Dan)');
  const [modulo, setModulo] = useState('');
  const [media, setMedia] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [avRes, candRes] = await Promise.all([
        supabase.from('avaliacoes_teoricas').select('*').order('data', { ascending: false }),
        supabase.from('candidatos').select('*').order('nome')
      ]);

      if (avRes.error) throw avRes.error;
      if (candRes.error) throw candRes.error;

      setAvaliacoes(avRes.data || []);
      setCandidatos(candRes.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados:', err);
      setError('Não foi possível carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const candidato = candidatos.find(c => c.id === candidatoId);
    if (!candidato) {
      setError('Selecione um candidato válido.');
      return;
    }

    try {
      const { data: newAv, error } = await supabase.from('avaliacoes_teoricas').insert([{
        data,
        candidato_id: candidatoId,
        candidato_nome: candidato.nome,
        grau_pretendido: grauPretendido,
        modulo,
        media: parseFloat(media)
      }]).select();

      if (error) throw error;

      if (newAv) {
        setAvaliacoes([newAv[0], ...avaliacoes]);
        setIsAdding(false);
        // Reset form
        setCandidatoId('');
        setModulo('');
        setMedia('');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar:', err);
      setError('Erro ao salvar a avaliação.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta avaliação?')) return;

    try {
      const { error } = await supabase.from('avaliacoes_teoricas').delete().eq('id', id);
      if (error) throw error;
      setAvaliacoes(avaliacoes.filter(a => a.id !== id));
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      alert('Erro ao excluir a avaliação.');
    }
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
          alert('O arquivo CSV parece estar vazio ou não tem cabeçalho.');
          return;
        }

        // Detectar separador
        const headerLine = lines[0];
        const separator = headerLine.includes(';') ? ';' : ',';
        
        // Parse headers
        const headers = headerLine.split(separator).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        
        const idxData = headers.findIndex(h => h.includes('data'));
        const idxNome = headers.findIndex(h => h.includes('candidato'));
        const idxGrau = headers.findIndex(h => h.includes('grau'));
        const idxModulo = headers.findIndex(h => h.includes('modulo') || h.includes('módulo'));
        const idxMedia = headers.findIndex(h => h.includes('media') || h.includes('média'));

        if (idxData === -1 || idxNome === -1 || idxGrau === -1 || idxModulo === -1 || idxMedia === -1) {
          alert('Cabeçalho inválido. Certifique-se de que as colunas data, candidato_nome, grau_pretendido, modulo e media existam.');
          return;
        }

        const newAvaliacoes = [];
        // Pula o cabeçalho (i = 1)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Trata separador dentro de aspas
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const values = line.split(regex).map(v => v.replace(/^"|"$/g, '').trim());
          
          if (values.length >= 5) {
            const csvData = values[idxData];
            const candidatoNome = values[idxNome];
            const grau = values[idxGrau];
            const mod = values[idxModulo];
            let medStr = values[idxMedia];
            
            // Pula linhas vazias (ex: ";;;;")
            if (!csvData || !candidatoNome) continue;
            
            // Limpa o valor da média (remove % e troca vírgula por ponto)
            medStr = medStr?.replace('%', '')?.replace(',', '.')?.trim() || '0';
            const med = parseFloat(medStr);
            
            // Tenta encontrar o candidato pelo nome
            const candidato = candidatos.find(c => c.nome.toLowerCase() === candidatoNome.toLowerCase());
            
            newAvaliacoes.push({
              data: csvData,
              candidato_id: candidato ? candidato.id : null,
              candidato_nome: candidatoNome,
              grau_pretendido: grau || 'Shodan (1º Dan)',
              modulo: mod || 'Geral',
              media: isNaN(med) ? 0 : med
            });
          }
        }

        if (newAvaliacoes.length > 0) {
          const { data: insertedData, error } = await supabase.from('avaliacoes_teoricas').insert(newAvaliacoes).select();
          if (error) throw error;
          
          if (insertedData) {
            setAvaliacoes([...insertedData, ...avaliacoes].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()));
            alert(`${insertedData.length} avaliações importadas com sucesso!`);
          }
        } else {
          alert('Nenhum dado válido encontrado para importar.');
        }
      } catch (err: any) {
        console.error('Erro ao importar CSV:', err);
        alert('Erro ao importar o arquivo CSV. Verifique o formato.');
      }
      
      // Limpa o input file
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ['data', 'candidato_nome', 'grau_pretendido', 'modulo', 'media'];
    const example = ['2026-03-29', 'João Silva', 'Shodan (1º Dan)', 'História do Judô', '8.5'];
    
    const csvContent = [
      headers.join(','),
      example.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_avaliacoes_teoricas.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando avaliações...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-red-600" /> Avaliações Teóricas
        </h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Modelo CSV
          </button>
          
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Importar CSV
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </label>
          
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar Manual
          </button>
        </div>
      </div>

      <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mb-6">
        <strong>Formato esperado do CSV:</strong> data (YYYY-MM-DD), candidato_nome, grau_pretendido, modulo, media (A primeira linha deve ser o cabeçalho).
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Nova Avaliação Teórica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
              <input 
                type="date" 
                required
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Candidato</label>
              <select 
                required
                value={candidatoId}
                onChange={e => setCandidatoId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">Selecione...</option>
                {candidatos.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Grau Pretendido</label>
              <select 
                required
                value={grauPretendido}
                onChange={e => setGrauPretendido(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="Shodan (1º Dan)">Shodan (1º Dan)</option>
                <option value="Nidan (2º Dan)">Nidan (2º Dan)</option>
                <option value="Sandan (3º Dan)">Sandan (3º Dan)</option>
                <option value="Yondan (4º Dan)">Yondan (4º Dan)</option>
                <option value="Godan (5º Dan)">Godan (5º Dan)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Módulo</label>
              <input 
                type="text" 
                required
                placeholder="Ex: História do Judô"
                value={modulo}
                onChange={e => setModulo(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Média</label>
              <input 
                type="number" 
                step="0.1"
                min="0"
                max="10"
                required
                placeholder="Ex: 8.5"
                value={media}
                onChange={e => setMedia(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 text-sm uppercase tracking-wider border-b border-slate-200">
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Candidato</th>
              <th className="p-4 font-medium">Grau Pretendido</th>
              <th className="p-4 font-medium">Módulo</th>
              <th className="p-4 font-medium text-center">Média</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {avaliacoes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Nenhuma avaliação teórica cadastrada.
                </td>
              </tr>
            ) : (
              avaliacoes.map((av) => (
                <tr key={av.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800">{new Date(av.data).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 font-medium text-slate-800">{av.candidato_nome}</td>
                  <td className="p-4 text-slate-600">{av.grau_pretendido}</td>
                  <td className="p-4 text-slate-600">{av.modulo}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{Number(av.media).toFixed(1)}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(av.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
