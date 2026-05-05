import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, UserCircle } from 'lucide-react';

interface CensoPerfilProps {
  candidato: any;
}

export function CensoPerfil({ candidato }: CensoPerfilProps) {
  const [data, setData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (candidato?.id) {
      fetchPerfil();
    }
  }, [candidato]);

  const fetchPerfil = async () => {
    setIsLoading(true);
    try {
      const { data: cData, error } = await supabase
        .from('candidatos')
        .select('curriculo_json')
        .eq('id', candidato.id || candidato.reference_id)
        .single();
        
      if (error) throw error;
      if (cData?.curriculo_json?.perfil && typeof cData.curriculo_json.perfil === 'object') {
        setData(cData.curriculo_json.perfil);
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
      // First get existing curriculo_json to not overwrite it
      const { data: cData } = await supabase
        .from('candidatos')
        .select('curriculo_json')
        .eq('id', candidato.id || candidato.reference_id)
        .single();
        
      const existing = cData?.curriculo_json || {};
      
      const { error } = await supabase
        .from('candidatos')
        .update({ curriculo_json: { ...existing, perfil: data } })
        .eq('id', candidato.id || candidato.reference_id);
      if (error) {
        alert('Erro ao salvar o perfil.');
        throw error;
      }
      alert('Perfil salvo com sucesso!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleObjChange = (field: string, value: string) => {
    setData((prev: any) => ({ ...prev, [field]: value }));
  };

  const regioes = ['Salvador/RMS', 'Sul (Itabuna)', 'Sudoeste (Vitória da Conquista)', 'Oeste (Barreiras)'];

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando dados do perfil...</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
            <UserCircle className="w-6 h-6" /> Perfil do Candidato
          </h2>
          <p className="text-slate-300 text-sm">Censo de Candidatos à Graduação 2026</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar Perfil'}
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-10">
        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">1. Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Nome Completo</span>
              <span className="font-medium text-slate-800">{candidato.nome || '-'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Associação / Dojo</span>
              <span className="font-medium text-slate-800">{candidato.dojo || '-'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Reg ZEMPO</span>
              <span className="font-medium text-slate-800">{candidato.zempo || '-'}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Grau Pretendido</span>
              <span className="font-medium text-slate-800">{candidato.grau_pretendido || '-'}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">2. Região</h3>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Região onde participará dos módulos:</label>
            <div className="space-y-2">
              {regioes.map((regiao) => (
                <label key={regiao} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="regiao"
                    value={regiao}
                    checked={data.regiao === regiao}
                    onChange={(e) => handleObjChange('regiao', e.target.value)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-700">{regiao}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">3. Perfil e Atuação Atual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tempo na faixa atual (em anos):</label>
              <input
                type="number"
                value={data.tempoFaixaAtual || ''}
                onChange={(e) => handleObjChange('tempoFaixaAtual', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-sm"
                placeholder="Ex: 5"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Principal área de atuação:</label>
              <select
                value={data.areaAtuacao || ''}
                onChange={(e) => handleObjChange('areaAtuacao', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-sm"
              >
                <option value="">Selecione...</option>
                <option value="Atleta">Atleta</option>
                <option value="Professor Acadêmico/Escolar">Professor Acadêmico/Escolar</option>
                <option value="Projetos Sociais">Projetos Sociais</option>
                <option value="Árbitro">Árbitro</option>
                <option value="Gestor">Gestor</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">4. Motivação para a Graduação</h3>
          <p className="text-sm text-slate-600 mb-4">O que mais motiva você a ingressar neste processo de graduação em 2026?</p>
          <div className="space-y-3">
            {[
              "Realização Pessoal: Concluir uma etapa de vida e honrar minha trajetória no Judô.",
              "Exigência Profissional: Regularização para lecionar em academias, clubes ou escolas.",
              "Liderança e Exemplo: Tornar-me uma referência técnica para meus alunos e minha comunidade.",
              "Contribuição Institucional: Poder servir à Federação em funções técnicas ou de arbitragem que exigem o novo grau."
            ].map(motivacao => (
              <label key={motivacao} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="motivacao"
                  value={motivacao}
                  checked={data.motivacao === motivacao}
                  onChange={(e) => handleObjChange('motivacao', e.target.value)}
                  className="w-4 h-4 mt-0.5 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">{motivacao}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">5. Visão de Futuro e Expectativas</h3>
          <p className="text-sm text-slate-600 mb-4">Após a conquista da nova graduação, qual é o seu principal desejo em relação à sua atuação futura no Judô?</p>
          <div className="space-y-3">
            {[
              "Expansão de Ensino: Abrir o próprio Dojo ou expandir o número de alunos e turmas.",
              "Especialização Técnica: Focar no estudo profundo de Katas e fundamentos para tornar-me um professor técnico.",
              "Carreira na Arbitragem: Ingressar ou subir de categoria no quadro de árbitros da FEBAJU/CBJ.",
              "Gestão e Eventos: Atuar na organização de campeonatos, seminários e projetos administrativos do esporte.",
              "Judô Educacional: Implementar metodologias pedagógicas mais modernas em escolas e projetos.",
              "Treinamento de Alto Rendimento: Atuar na preparação técnica e tática de atletas para competições estaduais e nacionais."
            ].map(visao => (
              <label key={visao} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="visaoFuturo"
                  value={visao}
                  checked={data.visaoFuturo === visao}
                  onChange={(e) => handleObjChange('visaoFuturo', e.target.value)}
                  className="w-4 h-4 mt-0.5 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-700">{visao}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">6. Autoavaliação Técnica (Escala 1 a 5)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'autoAvalFundamentos', label: 'Fundamentos e Etiqueta (Rei-ho/Shintai/Taisabaki/Kumikata etc.)' },
              { id: 'autoAvalNageWaza', label: 'Técnicas de Projeção (Nage-waza)' },
              { id: 'autoAvalKatameWaza', label: 'Técnicas de Solo (Katame-waza)' },
              { id: 'autoAvalKata', label: 'Domínio de Kata' }
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <label key={score} className="flex flex-col items-center gap-1 cursor-pointer">
                      <span className="text-[10px] text-slate-500">{score}</span>
                      <input
                        type="radio"
                        name={item.id}
                        value={score.toString()}
                        checked={data[item.id] === score.toString()}
                        onChange={(e) => handleObjChange(item.id, e.target.value)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-2">7. Observações Adicionais</h3>
          <p className="text-sm text-slate-600 mb-2">Descreva brevemente qualquer outra expectativa ou necessidade específica que você tenha para este ciclo de 6 módulos.</p>
          <textarea
            value={data.observacoes || ''}
            onChange={(e) => handleObjChange('observacoes', e.target.value)}
            className="w-full p-3 border border-slate-300 rounded focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[120px]"
            placeholder="Digite aqui suas observações..."
          />
        </section>
      </div>
    </div>
  );
}
