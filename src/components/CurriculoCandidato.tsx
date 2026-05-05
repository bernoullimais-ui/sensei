import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Plus, Trash2, FileText, AlertCircle } from 'lucide-react';
import {
  formacaoScores,
  eventosTypes,
  eventosScores,
  arbitroShiaiScores,
  arbitroKataScores,
  cargosTipos,
  cargosScores,
  competicoesAtletaTipos,
  competicoesAtletaScores,
  atuacaoCompeticoesTipos,
  atuacaoCompeticoesScores,
  historicoForaCarenciaTipos,
  historicoForaCarenciaScores,
  producaoAcademicaTipos,
  producaoAcademicaScores,
  getCarenciaAnos,
  isAnoValid,
  getAnosValidosCargo
} from './CurriculoCandidato.utils';

interface CurriculoCandidatoProps {
  candidato: any;
}

export function CurriculoCandidato({ candidato }: CurriculoCandidatoProps) {
  const [data, setData] = useState<any>({
    anoExame: new Date().getFullYear().toString(),
    formacao: { escolaridade: '', ano: '', instituicao: '', curso: '', pontuacao: 0 },
    eventos: [],
    arbitragem: { categoriaShiai: '', pontuacaoShiai: 0, ambitoKata: '', quantidadeKata: 1, pontuacaoKata: 0 },
    cargos: [],
    competicoesAtleta: [],
    atuacaoCompeticoes: [],
    historicoForaCarencia: [],
    producaoAcademica: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCurriculo();
  }, []);

  const fetchCurriculo = async () => {
    setIsLoading(true);
    try {
      const { data: cData, error } = await supabase
        .from('candidatos')
        .select('curriculo_json')
        .eq('id', candidato.id)
        .single();
        
      if (error) throw error;
      if (cData?.curriculo_json && typeof cData.curriculo_json === 'object') {
        setData((prev: any) => ({
          ...prev,
          ...cData.curriculo_json,
          anoExame: cData.curriculo_json.anoExame || prev.anoExame,
          formacao: { ...prev.formacao, ...(cData.curriculo_json.formacao || {}) },
          arbitragem: { ...prev.arbitragem, ...(cData.curriculo_json.arbitragem || {}) },
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('candidatos')
        .update({ curriculo_json: data })
        .eq('id', candidato.id);
      if (error) {
        alert('Erro ao salvar currículo. Verifique se a coluna curriculo_json existe no banco.');
        throw error;
      }
      alert('Currículo salvo com sucesso!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleListChange = (listName: string, index: number, field: string, value: any) => {
    const list = [...data[listName]];
    list[index][field] = value;
    setData({ ...data, [listName]: list });
  };

  const addToList = (listName: string, emptyItem: any) => {
    setData({ ...data, [listName]: [...data[listName], { id: Date.now().toString(), ...emptyItem }] });
  };

  const removeFromList = (listName: string, index: number) => {
    const list = [...data[listName]];
    list.splice(index, 1);
    setData({ ...data, [listName]: list });
  };

  const anoExameNum = Number(data.anoExame || new Date().getFullYear());
  const carenciaAnosNum = getCarenciaAnos(candidato?.grau_pretendido || '');

  const isLocked = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0 is January, 11 is December
    
    if (currentYear > anoExameNum) return true;
    if (currentYear === anoExameNum && currentMonth >= 11) return true;
    return false;
  };
  
  const locked = isLocked();

  // Helper to sum points
  const calcTotal = () => {
    // 1. Formação
    let formacaoPts = Number(data.formacao?.pontuacao || 0);

    // 2. Graduação Arbitragem
    let arbitragemPts = Number(data.arbitragem?.pontuacaoShiai || 0) + Number(data.arbitragem?.pontuacaoKata || 0);

    // 3. Cargos Administrativos
    let cargosPts = 0;
    if (data.cargos) {
      cargosPts = data.cargos.reduce((acc: number, item: any) => {
        let ptsForCargo = 0;
        if (cargosScores[item.cargo]) {
          const basePts = cargosScores[item.cargo].pts;
          if (cargosScores[item.cargo].isAnual) {
            const validCount = getAnosValidosCargo(item.anoInicial, item.anoFinal, anoExameNum, carenciaAnosNum);
            ptsForCargo = validCount > 0 ? basePts * validCount : 0; // Se preencheu, só vale validos
          } else {
             // Not annual: check if AT LEAST ONE of the years fits in carencia?
             // Actually, for singular, we can use start year or end year
             const validCount = getAnosValidosCargo(item.anoInicial, item.anoFinal || item.anoInicial, anoExameNum, carenciaAnosNum);
             if (validCount > 0) ptsForCargo = basePts;
          }
        }
        return acc + ptsForCargo;
      }, 0);
    }
    
    // 4. Eventos
    let eventosPts = 0;
    if (data.eventos) {
      eventosPts = data.eventos.reduce((acc: number, item: any) => {
        let valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
        if (item.evento === 'Cursos fora do periodo de carencia' && (item.ambito === 'Nacional' || item.ambito === 'Internacional')) {
          valid = true; // Exceção à regra de carência
        }
        return acc + (valid ? Number(item.pontuacao || 0) : 0);
      }, 0);
    }
    
    // 5. Competições Atleta
    let competicoesPts = 0;
    if (data.competicoesAtleta) {
      competicoesPts = data.competicoesAtleta.reduce((acc: number, item: any) => {
        const valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
        return acc + (valid ? Number(item.pontuacao || 0) : 0);
      }, 0);
    }

    // 6. Atuação em Competições
    let atuacaoPts = 0;
    if (data.atuacaoCompeticoes) {
      atuacaoPts = data.atuacaoCompeticoes.reduce((acc: number, item: any) => {
        const valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
        return acc + (valid ? Number(item.pontuacao || 0) : 0);
      }, 0);
    }

    // 7. Histórico
    let historicoPts = 0;
    if (data.historicoForaCarencia) {
      historicoPts = data.historicoForaCarencia.reduce((acc: number, item: any) => acc + Number(item.pontuacao || 0), 0);
    }

    // 8. Produção
    let producaoPts = 0;
    if (data.producaoAcademica) {
      producaoPts = data.producaoAcademica.reduce((acc: number, item: any) => acc + Number(item.pontuacao || 0), 0);
    }

    return formacaoPts + eventosPts + arbitragemPts + cargosPts + competicoesPts + atuacaoPts + historicoPts + producaoPts;
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando currículo...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-red-600" /> Meu Currículo
          </h2>
          <p className="text-sm text-slate-500 mt-1">Prencha seus dados de acordo com o Regulamento de Graus da CBJ.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pontuação Total</div>
            <div className="text-2xl font-black text-red-600">{calcTotal()} <span className="text-sm font-normal text-slate-500">pts</span></div>
          </div>
          {locked ? (
            <div className="px-4 py-2 bg-red-100 text-red-800 rounded-md font-bold text-sm border border-red-200">
              Edição Encerrada
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Currículo'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-8 flex flex-col gap-3 text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Instruções:</strong> Confirmo que o teor dessa declaração é verdadeiro e estou ciente que a comissão de graduação poderá solicitar as comprovações das informações inseridas por meio de certificado ou declaração da entidade promotora de cada atividade mencionada.
          </div>
        </div>
        {locked && (
          <div className="flex items-start gap-3 mt-2 font-semibold text-red-700">
             <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
               Este currículo não pode mais ser editado, pois o prazo finalizou em Novembro do ano de Exame.
             </div>
          </div>
        )}
      </div>

      <div className={`space-y-10 ${locked ? 'pointer-events-none opacity-80' : ''}`}>
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">Identificação</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Nome</span>
              <span className="font-medium text-slate-800">{candidato.nome}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Associação/Dojo</span>
              <span className="font-medium text-slate-800">{candidato.dojo || '-'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Reg. ZEMPO</span>
              <span className="font-medium text-slate-800">{candidato.zempo || '-'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Grau Pretendido</span>
              <span className="font-medium text-slate-800">{candidato.grau_pretendido || '-'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4 shadow-sm bg-slate-50 border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">Ano do Exame (Análise)</label>
              <input type="number" className="w-full p-2 border rounded bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none font-semibold text-slate-800" value={data.anoExame || ''} onChange={(e) => setData({...data, anoExame: e.target.value})} />
              <p className="text-[10px] text-slate-500 mt-1">Altere se o currículo for referente a anos anteriores.</p>
            </div>
            <div className="border rounded-xl p-4 shadow-sm bg-slate-50 border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">Período de Carência do Candidato</label>
              <input type="text" className="w-full p-2 border rounded bg-slate-200 text-sm font-semibold text-slate-700 outline-none" readOnly value={`${carenciaAnosNum} Ano(s) (Válido de ${anoExameNum - carenciaAnosNum + 1} a ${anoExameNum})`} />
              <p className="text-[10px] text-red-600 font-semibold mt-1">Atenção: Eventos fora deste período terão a pontuação zerada automaticamente (exceto o item 7).</p>
            </div>
          </div>
        </section>

        {/* 1. Formação */}
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">1. Formação</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Escolaridade (Mais alta)</label>
              <select 
                value={data.formacao?.escolaridade || ''} 
                onChange={e => {
                  const escolaridade = e.target.value;
                  const pontuacao = formacaoScores[escolaridade] || 0;
                  setData({...data, formacao: {...(data.formacao || {}), escolaridade, pontuacao}});
                }}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-sm"
              >
                <option value="">Selecione...</option>
                {Object.keys(formacaoScores).map(opt => (
                  <option key={opt} value={opt}>{opt} ({formacaoScores[opt]} pts)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ano Conclusão</label>
              <input type="text" value={data.formacao?.ano || ''} onChange={e => setData({...data, formacao: {...(data.formacao || {}), ano: e.target.value}})} className="w-full p-2 border border-slate-300 rounded text-sm outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Instituição / Curso</label>
              <input type="text" placeholder="Ex: USP / Ed. Física" value={data.formacao?.instituicao || ''} onChange={e => setData({...data, formacao: {...(data.formacao || {}), instituicao: e.target.value}})} className="w-full p-2 border border-slate-300 rounded text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-red-700 mb-1">Pontuação</label>
              <input type="number" readOnly value={data.formacao?.pontuacao || 0} className="w-full p-2 border border-red-300 bg-red-50 rounded text-sm outline-none font-bold text-red-800" />
            </div>
          </div>
        </section>

        {/* 2. Arbitragem */}
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">2. Graduação na Arbitragem</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">Árbitro Shiai</h4>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                  <select 
                    value={data.arbitragem?.categoriaShiai || ''} 
                    onChange={e => {
                      const val = e.target.value;
                      setData({...data, arbitragem: {...(data.arbitragem || {}), categoriaShiai: val, pontuacaoShiai: arbitroShiaiScores[val] || 0}});
                    }} 
                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Nenhuma</option>
                    {Object.keys(arbitroShiaiScores).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-red-700 mb-1">Pontos</label>
                  <input type="number" readOnly value={data.arbitragem?.pontuacaoShiai || 0} className="w-full p-2 border border-red-300 bg-red-50 rounded text-sm font-bold text-red-800" />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">Árbitro Kata</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Âmbito</label>
                  <select 
                    value={data.arbitragem?.ambitoKata || ''} 
                    onChange={e => {
                       const val = e.target.value;
                       const pts = arbitroKataScores[val]?.[data.arbitragem?.quantidadeKata || "1"] || 0;
                       setData({...data, arbitragem: {...(data.arbitragem || {}), ambitoKata: val, pontuacaoKata: pts}});
                    }} 
                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Nenhum</option>
                    <option value="Estadual">Estadual</option>
                    <option value="Nacional">Nacional</option>
                    <option value="Continental">Continental</option>
                    <option value="Internacional">Internacional</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Qtd Kata</label>
                  <select 
                    value={data.arbitragem?.quantidadeKata || "1"} 
                    onChange={e => {
                      const val = e.target.value;
                      const pts = arbitroKataScores[data.arbitragem?.ambitoKata || ""]?.[val] || 0;
                      setData({...data, arbitragem: {...(data.arbitragem || {}), quantidadeKata: val, pontuacaoKata: pts}});
                    }} 
                    className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                  >
                     <option value="1">1 Kata</option>
                     <option value="2">2 Katas</option>
                     <option value="3">3 Katas</option>
                     <option value="4">4 Katas</option>
                     <option value="5">5 Katas</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-bold text-red-700 mb-1">Pontos</label>
                  <input type="number" readOnly value={data.arbitragem?.pontuacaoKata || 0} className="w-full p-2 border border-red-300 bg-red-50 rounded text-sm font-bold text-red-800" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Cargos Administrativos */}
        <section>
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-lg text-slate-800">3. Cargos Administrativos</h3>
            <button onClick={() => addToList('cargos', { cargo: '', anoInicial: '', anoFinal: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar Cargo</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 font-semibold">Cargo (Pres. Federação, Dirigente, etc)</th>
                  <th className="p-2 font-semibold">Ano Inicial</th>
                  <th className="p-2 font-semibold">Ano Final</th>
                  <th className="p-2 font-semibold text-red-700 w-24">Pts</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.cargos?.map((item: any, i: number) => {
                  let visiblePts = 0;
                  let isValidCount = 0;
                  if (cargosScores[item.cargo]) {
                      const basePts = cargosScores[item.cargo].pts;
                      if (cargosScores[item.cargo].isAnual) {
                          isValidCount = getAnosValidosCargo(item.anoInicial, item.anoFinal, anoExameNum, carenciaAnosNum);
                          visiblePts = isValidCount > 0 ? basePts * isValidCount : 0;
                      } else {
                          isValidCount = getAnosValidosCargo(item.anoInicial, item.anoFinal || item.anoInicial, anoExameNum, carenciaAnosNum);
                          if (isValidCount > 0) visiblePts = basePts;
                      }
                  }
                  const valid = isValidCount > 0;
                  return (
                  <tr key={item.id} className={`border-b border-slate-100 ${!valid && (item.anoInicial || item.anoFinal) ? 'opacity-50' : ''}`}>
                    <td className="p-2">
                       <select className="w-full p-1 border rounded text-xs bg-white" value={item.cargo} onChange={e => {
                         const val = e.target.value;
                         handleListChange('cargos', i, 'cargo', val);
                       }}>
                         <option value="">Selecione...</option>
                         {cargosTipos.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </td>
                    <td className="p-2">
                      <input className="w-full p-1 border rounded w-20 text-xs bg-white" value={item.anoInicial} onChange={e => {
                        handleListChange('cargos', i, 'anoInicial', e.target.value);
                      }} />
                    </td>
                    <td className="p-2">
                      <input className="w-full p-1 border rounded w-20 text-xs bg-white" value={item.anoFinal} onChange={e => {
                         handleListChange('cargos', i, 'anoFinal', e.target.value);
                      }} />
                    </td>
                    <td className="p-2">
                      <input type="number" readOnly className={`w-full p-1 border ${valid ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-100 text-slate-500 line-through'} font-bold rounded text-xs`} value={visiblePts} title={valid ? '' : 'Fora do período de carência'} />
                    </td>
                    <td className="p-2 text-right"><button onClick={() => removeFromList('cargos', i)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                )})}
              </tbody>
            </table>
             {data.cargos?.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">Nenhum cargo adicionado.</div>}
          </div>
        </section>

        {/* 4. Eventos */}
        <section>
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-lg text-slate-800">4. Eventos Relacionados (Cursos, Palestras)</h3>
            <button onClick={() => addToList('eventos', { nomeEvento: '', evento: '', carga: '', instituicao: '', ambito: '', atuacao: '', ano: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar Evento</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 font-semibold">Nome do Evento</th>
                  <th className="p-2 font-semibold">Tipo de Evento</th>
                  <th className="p-2 font-semibold">Âmbito</th>
                  <th className="p-2 font-semibold">Instituição</th>
                  <th className="p-2 font-semibold">Atuação</th>
                  <th className="p-2 font-semibold">Ano</th>
                  <th className="p-2 font-semibold text-red-700">Pts</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.eventos?.map((item: any, i: number) => {
                  let valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
                  if (item.evento === 'Cursos fora do periodo de carencia' && (item.ambito === 'Nacional' || item.ambito === 'Internacional')) {
                    valid = true;
                  }
                  return (
                  <tr key={item.id} className={`border-b border-slate-100 ${!valid ? 'opacity-50' : ''}`}>
                    <td className="p-2"><input placeholder="Nome do Evento" className="w-full p-1 border rounded text-xs bg-white" value={item.nomeEvento || ''} onChange={e => handleListChange('eventos', i, 'nomeEvento', e.target.value)} /></td>
                    <td className="p-2">
                      <select className="w-full p-1 border rounded text-xs" value={item.evento} onChange={e => {
                        handleListChange('eventos', i, 'evento', e.target.value);
                        const pts = eventosScores[e.target.value]?.[item.ambito] || 0;
                        handleListChange('eventos', i, 'pontuacao', pts);
                      }}>
                        <option value="">Selecione...</option>
                        {eventosTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="w-full p-1 border rounded text-xs" value={item.ambito} onChange={e => {
                        handleListChange('eventos', i, 'ambito', e.target.value);
                        const pts = eventosScores[item.evento]?.[e.target.value] || 0;
                        handleListChange('eventos', i, 'pontuacao', pts);
                      }}>
                        <option value="">Selecione...</option>
                        <option value="Regional">Regional</option>
                        <option value="Estadual">Estadual</option>
                        <option value="Nacional">Nacional</option>
                        <option value="Internacional">Internacional</option>
                      </select>
                    </td>
                    <td className="p-2"><input placeholder="Inst. etc" className="w-full p-1 border rounded text-xs bg-white" value={item.instituicao} onChange={e => handleListChange('eventos', i, 'instituicao', e.target.value)} /></td>
                    <td className="p-2">
                      <select className="w-full p-1 border rounded text-xs bg-white" value={item.atuacao} onChange={e => handleListChange('eventos', i, 'atuacao', e.target.value)}>
                        <option value="">Selecione...</option>
                        <option value="Participante">Participante</option>
                        <option value="Ouvinte">Ouvinte</option>
                        <option value="Ministrante">Ministrante</option>
                        <option value="Auxiliar">Auxiliar</option>
                      </select>
                    </td>
                    <td className="p-2"><input className="w-full p-1 border rounded w-16 text-xs bg-white" value={item.ano} onChange={e => handleListChange('eventos', i, 'ano', e.target.value)} /></td>
                    <td className="p-2">
                      <input type="number" readOnly className={`w-full p-1 border ${valid ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-100 text-slate-500 line-through'} font-bold rounded w-16 text-xs`} value={valid ? item.pontuacao : 0} title={valid ? '' : 'Fora do período de carência'} />
                    </td>
                    <td className="p-2 text-right"><button onClick={() => removeFromList('eventos', i)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                )})}
              </tbody>
            </table>
            {data.eventos?.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">Nenhum evento adicionado.</div>}
          </div>
        </section>

        {/* 5. e 6. Competicoes e Atuacao */}
        <div className="space-y-8">
          <section>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
              <h3 className="font-bold text-lg text-slate-800">5. Competições como Atleta</h3>
              <button onClick={() => addToList('competicoesAtleta', { nomeEvento: '', evento: '', ambito: '', classificacao: '', ano: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar</button>
            </div>
            <div className="space-y-3">
              {data.competicoesAtleta?.map((item: any, i: number) => {
                const valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
                return (
                <div key={item.id} className={`flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100 ${!valid ? 'opacity-50' : ''}`}>
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <input className="w-full p-1 border rounded text-xs bg-white" placeholder="Nome do Evento" value={item.nomeEvento || ''} onChange={e => handleListChange('competicoesAtleta', i, 'nomeEvento', e.target.value)} />
                    </div>
                    <div className="col-span-4">
                      <select className="w-full p-1 border rounded text-xs bg-white" value={item.evento} onChange={e => {
                          const val = e.target.value;
                          handleListChange('competicoesAtleta', i, 'evento', val);
                          const pts = competicoesAtletaScores[val]?.[item.classificacao] || 0;
                          handleListChange('competicoesAtleta', i, 'pontuacao', pts);
                      }}>
                        <option value="">Âmbito</option>
                        {competicoesAtletaTipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <select className="w-full p-1 border rounded text-xs bg-white" value={item.classificacao} onChange={e => {
                        const val = e.target.value;
                        handleListChange('competicoesAtleta', i, 'classificacao', val);
                        const pts = competicoesAtletaScores[item.evento]?.[val] || 0;
                        handleListChange('competicoesAtleta', i, 'pontuacao', pts);
                      }}>
                        <option value="">Colocação</option>
                        <option value="1º lugar">1º Lugar</option>
                        <option value="2º lugar">2º Lugar</option>
                        <option value="3º lugar">3º Lugar</option>
                        <option value="Participação">Participação</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input className="w-full p-1 border rounded text-xs bg-white" placeholder="Ano" value={item.ano} onChange={e => handleListChange('competicoesAtleta', i, 'ano', e.target.value)} />
                    </div>
                  </div>
                  <div className="w-16 shrink-0 flex gap-2 items-center" title={valid ? '' : 'Fora do período de carência'}>
                    <input type="number" readOnly className={`w-full p-1 border ${valid ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-100 text-slate-500 line-through'} font-bold rounded text-center text-xs`} value={valid ? item.pontuacao : 0} />
                  </div>
                  <button onClick={() => removeFromList('competicoesAtleta', i)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              )})}
              {data.competicoesAtleta?.length === 0 && <div className="p-2 text-center text-slate-400 text-sm">Vazio.</div>}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
              <h3 className="font-bold text-lg text-slate-800">6. Atuação em Competições</h3>
              <button onClick={() => addToList('atuacaoCompeticoes', { nomeEvento: '', evento: '', ambito: '', atuacao: '', ano: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar</button>
            </div>
            <div className="space-y-3">
              {data.atuacaoCompeticoes?.map((item: any, i: number) => {
                const valid = isAnoValid(item.ano, anoExameNum, carenciaAnosNum);
                return (
                <div key={item.id} className={`flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100 ${!valid ? 'opacity-50' : ''}`}>
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <input className="w-full p-1 border rounded text-xs bg-white" placeholder="Nome do Evento" value={item.nomeEvento || ''} onChange={e => handleListChange('atuacaoCompeticoes', i, 'nomeEvento', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <select className="w-full p-1 border rounded text-xs bg-white" value={item.ambito} onChange={e => {
                        const val = e.target.value;
                        handleListChange('atuacaoCompeticoes', i, 'ambito', val);
                        const pts = atuacaoCompeticoesScores[item.atuacao]?.[val] || 0;
                        handleListChange('atuacaoCompeticoes', i, 'pontuacao', pts);
                      }}>
                        <option value="">Âmbito</option>
                        <option value="Torneios locais">Torneios locais</option>
                        <option value="Regional/Estadual/Seletivas">Regional/Estadual/Seletivas</option>
                        <option value="Brasileiro Regional">Brasileiro Regional</option>
                        <option value="Brasileiros">Brasileiros</option>
                        <option value="Internacionais">Internacionais</option>
                        <option value="Circuito FIJ">Circuito FIJ</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <select className="w-full p-1 border rounded text-xs bg-white" value={item.atuacao} onChange={e => {
                        const val = e.target.value;
                        handleListChange('atuacaoCompeticoes', i, 'atuacao', val);
                        const pts = atuacaoCompeticoesScores[val]?.[item.ambito] || 0;
                        handleListChange('atuacaoCompeticoes', i, 'pontuacao', pts);
                      }}>
                        <option value="">Atuação</option>
                        {atuacaoCompeticoesTipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input className="w-full p-1 border rounded text-xs bg-white" placeholder="Ano" value={item.ano} onChange={e => handleListChange('atuacaoCompeticoes', i, 'ano', e.target.value)} />
                    </div>
                  </div>
                  <div className="w-16 shrink-0 flex gap-2 items-center" title={valid ? '' : 'Fora do período de carência'}>
                    <input type="number" readOnly className={`w-full p-1 border ${valid ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-100 text-slate-500 line-through'} font-bold rounded text-center text-xs`} value={valid ? item.pontuacao : 0} />
                  </div>
                  <button onClick={() => removeFromList('atuacaoCompeticoes', i)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              )})}
              {data.atuacaoCompeticoes?.length === 0 && <div className="p-2 text-center text-slate-400 text-sm">Vazio.</div>}
            </div>
          </section>
        </div>

        {/* 7. Histórico Fora Carência */}
        <section>
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-lg text-slate-800">7. Histórico (Fora do Período de Carência)</h3>
            <button onClick={() => addToList('historicoForaCarencia', { evento: '', ambito: '', classificacao: '', ano: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 font-semibold">Tipo de Evento</th>
                  <th className="p-2 font-semibold">Âmbito</th>
                  <th className="p-2 font-semibold">Classificação / Cargo</th>
                  <th className="p-2 font-semibold">Ano</th>
                  <th className="p-2 font-semibold text-red-700 w-24">Pts</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.historicoForaCarencia?.map((item: any, i: number) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="p-2">
                      <select className="w-full p-1 border rounded text-xs" value={item.evento} onChange={e => {
                        const val = e.target.value;
                        handleListChange('historicoForaCarencia', i, 'evento', val);
                        if (historicoForaCarenciaScores[val] && !historicoForaCarenciaScores[val].isAnual) {
                          handleListChange('historicoForaCarencia', i, 'pontuacao', historicoForaCarenciaScores[val].pts);
                        } else if (historicoForaCarenciaScores[val] && historicoForaCarenciaScores[val].isAnual && item.ano) {
                           // Try to parse years or just add pts once if unclear
                           const pt = historicoForaCarenciaScores[val].pts;
                           if (item.ano.includes('-')) {
                             const parts = item.ano.split('-');
                             const anosCount = (parseInt(parts[1]) || 0) - (parseInt(parts[0]) || 0) + 1;
                             handleListChange('historicoForaCarencia', i, 'pontuacao', anosCount > 0 ? pt * anosCount : pt);
                           } else {
                             handleListChange('historicoForaCarencia', i, 'pontuacao', pt);
                           }
                        } else {
                           handleListChange('historicoForaCarencia', i, 'pontuacao', 0);
                        }
                      }}>
                        <option value="">Selecione...</option>
                        {historicoForaCarenciaTipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input className="w-full p-1 border rounded" value={item.ambito} onChange={e => handleListChange('historicoForaCarencia', i, 'ambito', e.target.value)} /></td>
                    <td className="p-2"><input className="w-full p-1 border rounded" value={item.classificacao} onChange={e => handleListChange('historicoForaCarencia', i, 'classificacao', e.target.value)} /></td>
                    <td className="p-2"><input placeholder="Ex: 2018 ou 2018-2020" className="w-full p-1 border rounded w-full" value={item.ano} onChange={e => handleListChange('historicoForaCarencia', i, 'ano', e.target.value)} /></td>
                    <td className="p-2"><input type="number" readOnly className="w-full p-1 border border-red-300 bg-red-50 font-bold text-red-800 rounded" value={item.pontuacao} /></td>
                    <td className="p-2 text-right"><button onClick={() => removeFromList('historicoForaCarencia', i)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
             {data.historicoForaCarencia?.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">Vazio.</div>}
          </div>
        </section>

        {/* 8. Produção Acadêmica */}
        <section>
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="font-bold text-lg text-slate-800">8. Produção Acadêmica Relacionada ao Judô</h3>
            <button onClick={() => addToList('producaoAcademica', { titulo: '', tipo: '', instituicao: '', ano: '', pontuacao: 0 })} className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-700"><Plus className="w-4 h-4"/> Adicionar Publicação</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 font-semibold">Título da Publicação</th>
                  <th className="p-2 font-semibold">Tipo (Artigo, Tese, Livro...)</th>
                  <th className="p-2 font-semibold">Instituição / Revista</th>
                  <th className="p-2 font-semibold">Ano</th>
                  <th className="p-2 font-semibold text-red-700 w-24">Pts</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.producaoAcademica?.map((item: any, i: number) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="p-2"><input className="w-full p-1 border rounded" value={item.titulo} onChange={e => handleListChange('producaoAcademica', i, 'titulo', e.target.value)} /></td>
                    <td className="p-2">
                       <select className="w-full p-1 border rounded text-xs" value={item.tipo} onChange={e => {
                         const val = e.target.value;
                         handleListChange('producaoAcademica', i, 'tipo', val);
                         handleListChange('producaoAcademica', i, 'pontuacao', producaoAcademicaScores[val] || 0);
                       }}>
                         <option value="">Selecione...</option>
                         {producaoAcademicaTipos.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                    </td>
                    <td className="p-2"><input className="w-full p-1 border rounded" value={item.instituicao} onChange={e => handleListChange('producaoAcademica', i, 'instituicao', e.target.value)} /></td>
                    <td className="p-2"><input className="w-full p-1 border rounded w-16" value={item.ano} onChange={e => handleListChange('producaoAcademica', i, 'ano', e.target.value)} /></td>
                    <td className="p-2"><input type="number" readOnly className="w-full p-1 border border-red-300 bg-red-50 font-bold text-red-800 rounded" value={item.pontuacao} /></td>
                    <td className="p-2 text-right"><button onClick={() => removeFromList('producaoAcademica', i)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
             {data.producaoAcademica?.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">Nenhuma produção adicionada.</div>}
          </div>
        </section>

      </div>
    </div>
  );
}
