import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { PlacarResultados } from './components/PlacarResultados';
import { TreinamentoCapacitacao } from './components/TreinamentoCapacitacao';
import { TreinamentoParticipantFlow } from './components/TreinamentoParticipantFlow';
import { AvaliacoesTeoricas } from './components/AvaliacoesTeoricas';
import { BancoQuestoes } from './components/BancoQuestoes';
import { ProvasTeoricasAdmin } from './components/ProvasTeoricasAdmin';
import { RealizarProva } from './components/RealizarProva';
import { 
  User, 
  Award, 
  Activity, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Plus, 
  Trash2, 
  FileText,
  ChevronRight,
  Maximize,
  Save,
  Upload,
  Download,
  Users,
  UserCheck,
  ClipboardSignature,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Settings,
  Radio,
  GraduationCap,
  UserPlus,
  Clock,
  Edit,
  Trophy,
  RefreshCw,
  ArrowRight,
  Search,
  HelpCircle,
  CheckSquare
} from 'lucide-react';

type Dan = 'Shodan (1º Dan)' | 'Nidan (2º Dan)' | 'Sandan (3º Dan)' | 'Yondan (4º Dan)' | 'Godan (5º Dan)';
type PhaseStatus = 'AVALIAR' | 'Realizada' | 'Parcialmente Realizada' | 'Não Realizada' | 'Ótimo' | 'Bom' | 'Regular';
type HighDanScore = 'AVALIAR' | 'Ótimo' | 'Bom' | 'Regular' | '';
type ViewState = 'avaliacao' | 'candidatos' | 'avaliadores' | 'tecnicas' | 'katas' | 'resultados' | 'avaliacoes_teoricas' | 'treinamento' | 'banco_questoes' | 'provas_teoricas' | 'realizar_prova';

interface Tecnica {
  id: string;
  nome: string;
  grupo: string;
  tipo?: string;
}

interface KataDef {
  id: string;
  nome: string;
  ordem: number;
  grupo: string;
}

interface Candidato {
  id: string;
  nome: string;
  grau_pretendido: Dan;
  dojo: string;
  zempo: string;
  senha?: string;
}

interface ModuloAvaliacao {
  id: string;
  nome?: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  regiao: string;
  local: string;
  tema: string;
  quantidade_tecnicas?: number;
  avaliadores_ids?: string[];
  coordenadores_ids?: string[];
}

interface Avaliador {
  id: string;
  nome: string;
  graduacao: string;
  zempo?: string;
  funcao?: string;
  senha?: string;
}

interface Waza {
  id: string;
  name: string;
  kuzushi: PhaseStatus;
  tsukuri: PhaseStatus;
  kake: PhaseStatus;
}

interface KihonItem {
  id: string;
  name: string;
  status: PhaseStatus;
}

interface KataTechnique {
  id: string;
  name: string;
  smallErrors: number;
  mediumErrors: number;
  graveErrors: number;
  omitted: boolean;
  evaluated?: boolean;
}

interface HighDanEval {
  creativity: HighDanScore;
  innovation: HighDanScore;
  efficiency: HighDanScore;
}

export default function App() {
  const [placarModuloId, setPlacarModuloId] = useState<string | null>(null);
  const [treinamentoAccessId, setTreinamentoAccessId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placarId = params.get('placar');
    if (placarId) {
      setPlacarModuloId(placarId);
    }
    const treinamentoId = params.get('treinamento');
    if (treinamentoId) {
      setTreinamentoAccessId(treinamentoId);
    }
  }, []);

  const [currentView, setCurrentView] = useState<ViewState>('avaliacao');
  const [mainTab, setMainTab] = useState<'avaliacao' | 'configuracao' | 'resultados' | 'treinamento'>('avaliacao');
  
  // Filtros para Resultados das Avaliações
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroGrau, setFiltroGrau] = useState('');
  const [filtroCandidato, setFiltroCandidato] = useState('');
  const [filtroResultado, setFiltroResultado] = useState('');
  const [selectedResultados, setSelectedResultados] = useState<Set<string>>(new Set());
  const [resultadosToDelete, setResultadosToDelete] = useState<string[] | null>(null);
  
  const [selectedTecnicas, setSelectedTecnicas] = useState<Set<string>>(new Set());
  const [tecnicasToDelete, setTecnicasToDelete] = useState<string[] | null>(null);
  const [filtroTecnicaNome, setFiltroTecnicaNome] = useState('');
  const [filtroTecnicaGrupo, setFiltroTecnicaGrupo] = useState('');

  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // --- Cadastros State ---
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [avaliadores, setAvaliadores] = useState<Avaliador[]>([]);
  const [isImportTreinamentoModalOpen, setIsImportTreinamentoModalOpen] = useState(false);
  const [treinamentoParticipants, setTreinamentoParticipants] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [tecnicas, setTecnicas] = useState<Tecnica[]>([]);
  const [katas, setKatas] = useState<KataDef[]>([]);
  const [modulos, setModulos] = useState<ModuloAvaliacao[]>([]);
  const [resultados, setResultados] = useState<any[]>([]);
  const [resultadosTeoricos, setResultadosTeoricos] = useState<any[]>([]);
  const [resultadosProvas, setResultadosProvas] = useState<any[]>([]);
  const [isLoadingResultados, setIsLoadingResultados] = useState(false);
  
  // --- Avaliação State ---
  const [selectedModuloId, setSelectedModuloId] = useState('');
  const [isCreatingModulo, setIsCreatingModulo] = useState(false);
  const [editingModuloId, setEditingModuloId] = useState<string | null>(null);
  const [newModulo, setNewModulo] = useState<Partial<ModuloAvaliacao>>({ avaliadores_ids: [], coordenadores_ids: [] });

  const [selectedCandidatoId, setSelectedCandidatoId] = useState('');
  const [selectedAvaliadorId, setSelectedAvaliadorId] = useState('');
  const [evaluatedCandidatesIds, setEvaluatedCandidatesIds] = useState<string[]>([]);
  // Fallbacks for manual entry if not using the registered list
  const [manualCandidateName, setManualCandidateName] = useState('');
  const [targetDan, setTargetDan] = useState<Dan>('Shodan (1º Dan)');
  const [manualDojo, setManualDojo] = useState('');
  const [manualZempo, setManualZempo] = useState('');
  const [isAddingManualCandidate, setIsAddingManualCandidate] = useState(false);
  
  const [wazaList, setWazaList] = useState<Waza[]>([]);
  const [fullscreenWazaIndex, setFullscreenWazaIndex] = useState<number | null>(null);
  const [releasedWazaIndex, setReleasedWazaIndex] = useState<number>(-1);
  const [evaluatorsFinishedWaza, setEvaluatorsFinishedWaza] = useState<Record<string, number>>({});
  const [activeEvaluators, setActiveEvaluators] = useState<string[]>([]);
  const [fullscreenActiveTab, setFullscreenActiveTab] = useState<'kuzushi' | 'tsukuri' | 'kake'>('kuzushi');
  const [fullscreenKihonIndex, setFullscreenKihonIndex] = useState<number | null>(null);
  const [releasedKihonIndex, setReleasedKihonIndex] = useState<number>(-1);
  const [evaluatorsFinishedKihon, setEvaluatorsFinishedKihon] = useState<Record<string, number>>({});
  const [fullscreenKataIndex, setFullscreenKataIndex] = useState<number | null>(null);
  const [releasedKataIndex, setReleasedKataIndex] = useState<number>(-1);
  const [evaluatorsFinishedKata, setEvaluatorsFinishedKata] = useState<Record<string, number>>({});
  const [kihonList, setKihonList] = useState<KihonItem[]>([
    { id: 'kihon-1', name: 'Rei (Saudação)', status: 'AVALIAR' },
    { id: 'kihon-2', name: 'Kumi kata (Pegada)', status: 'AVALIAR' },
    { id: 'kihon-3', name: 'Shintai (Deslocamento)', status: 'AVALIAR' }
  ]);
  const [kataList, setKataList] = useState<KataTechnique[]>([]);
  const [highDanEval, setHighDanEval] = useState<HighDanEval>({
    creativity: '', innovation: '', efficiency: ''
  });

  const [selectedTema, setSelectedTema] = useState('');
  const [quantidadeSorteio, setQuantidadeSorteio] = useState<number>(1);

  const [selectedKataGroup, setSelectedKataGroup] = useState('');
  const [kataEvalMode, setKataEvalMode] = useState<'completo' | 'serie'>('completo');

  const [showReport, setShowReport] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [followingCoordinatorId, setFollowingCoordinatorId] = useState<string>('');
  const channelRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // --- Login State ---
  const [loggedUser, setLoggedUser] = useState<Avaliador | Candidato | null>(null);
  const [loggedRole, setLoggedRole] = useState<'avaliador' | 'candidato' | null>(null);
  const [loginZempo, setLoginZempo] = useState('');
  const [senhaZempo, setSenhaZempo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const cacheLoadedRef = useRef<string | null>(null);

  const isUserAdmin = (user: Avaliador | Candidato | null) => {
    if (!user || !('funcao' in user)) return false;
    return user.funcao === 'gestor' || user.funcao === 'admin' || user.nome?.trim().toLowerCase() === 'bruno maia pereira';
  };

  // --- Cache Local (Modo Offline) ---
  useEffect(() => {
    if (selectedModuloId && selectedCandidatoId && loggedUser) {
      const cacheKey = `eval_cache_${selectedModuloId}_${selectedCandidatoId}_${loggedUser.id}`;
      // Only save if there's actual data to save
      if (wazaList.length > 0 || kataList.length > 0 || kihonList.some(k => k.status !== 'AVALIAR') || highDanEval.creativity || highDanEval.innovation || highDanEval.efficiency) {
        const cacheData = {
          wazaList,
          kataList,
          kihonList,
          highDanEval,
          timestamp: new Date().getTime()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      }
    }
  }, [wazaList, kataList, kihonList, highDanEval, selectedModuloId, selectedCandidatoId, loggedUser]);

  const fileInputCandidatosRef = useRef<HTMLInputElement>(null);
  const fileInputAvaliadoresRef = useRef<HTMLInputElement>(null);
  const fileInputTecnicasRef = useRef<HTMLInputElement>(null);
  const fileInputKatasRef = useRef<HTMLInputElement>(null);

  // --- Fetch Initial Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candRes, avalRes, tecRes, kataRes, modulosRes] = await Promise.all([
          supabase.from('candidatos').select('id, nome, grau_pretendido, dojo, zempo').order('nome', { ascending: true }),
          supabase.from('avaliadores').select('id, nome, graduacao, zempo, funcao').order('nome', { ascending: true }),
          supabase.from('tecnicas').select('*').order('nome', { ascending: true }),
          supabase.from('katas').select('*').order('ordem', { ascending: true }),
          supabase.from('modulos_avaliacao').select('*').order('data', { ascending: true })
        ]);

        if (candRes.data) setCandidatos(candRes.data);
        if (avalRes.data) setAvaliadores(avalRes.data);
        if (tecRes.data) setTecnicas(tecRes.data);
        if (kataRes.data) setKatas(kataRes.data);
        if (modulosRes.data) setModulos(modulosRes.data);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedModuloId) {
      if (loggedUser) {
        const savedCoordId = localStorage.getItem(`following_coord_${selectedModuloId}_${loggedUser.id}`);
        setFollowingCoordinatorId(savedCoordId || '');
      } else {
        setFollowingCoordinatorId('');
      }
      const modulo = modulos.find(m => m.id === selectedModuloId);
      if (modulo) {
        setSelectedTema(modulo.tema || '');
        setQuantidadeSorteio(modulo.quantidade_tecnicas || 1);
      }
      
      // Fetch evaluated candidates for this module and evaluator
      const fetchEvaluated = async () => {
        if (!selectedAvaliadorId) return;
        const { data, error } = await supabase
          .from('avaliacoes')
          .select('candidato_id')
          .eq('modulo_id', selectedModuloId)
          .eq('avaliador_id', selectedAvaliadorId);
        
        if (data && !error) {
          setEvaluatedCandidatesIds(data.map(d => d.candidato_id).filter(Boolean) as string[]);
        }
      };
      fetchEvaluated();
    }
  }, [selectedModuloId, modulos, selectedAvaliadorId, loggedUser]);

  useEffect(() => {
    if (mainTab === 'resultados') {
      fetchResultados();
    }
  }, [mainTab, loggedUser, loggedRole]);

  const fetchResultados = async () => {
    setIsLoadingResultados(true);
    try {
      let query = supabase
        .from('avaliacoes')
        .select(`
          id,
          created_at,
          candidato_id,
          candidato_nome,
          grau_pretendido,
          avaliador_id,
          modulo_id,
          percentual_waza,
          nota_kata,
          veredito,
          sugestao_estudo,
          motivos_pendencia,
          observacoes_pedagogicas,
          erros_kata
        `)
        .order('created_at', { ascending: false });

      let queryTeoricas = supabase
        .from('avaliacoes_teoricas')
        .select('*')
        .order('created_at', { ascending: false });

      let queryProvas = supabase
        .from('prova_resultados')
        .select(`
          id,
          prova_id,
          candidato_id,
          nota,
          finalizada_em,
          provas_teoricas (titulo)
        `)
        .order('finalizada_em', { ascending: false });

      if (loggedRole === 'candidato' && loggedUser) {
        query = query.eq('candidato_id', loggedUser.id);
        queryTeoricas = queryTeoricas.eq('candidato_id', loggedUser.id);
        queryProvas = queryProvas.eq('candidato_id', loggedUser.id);
      }

      const [resData, teoricasData, provasData] = await Promise.all([
        query,
        queryTeoricas,
        queryProvas
      ]);

      if (resData.error) throw resData.error;
      if (teoricasData.error) throw teoricasData.error;
      if (provasData.error) throw provasData.error;

      setResultados(resData.data || []);
      setResultadosTeoricos(teoricasData.data || []);
      
      // Armazenar os resultados das provas no estado (vamos criar esse estado)
      setResultadosProvas(provasData.data || []);
    } catch (error) {
      console.error('Erro ao carregar resultados:', error);
      showToast('Erro ao carregar resultados.', 'error');
    } finally {
      setIsLoadingResultados(false);
    }
  };

  const confirmDeleteResultados = async () => {
    if (!resultadosToDelete || resultadosToDelete.length === 0) return;
    
    try {
      const dbIdsPraticas: string[] = [];
      const dbIdsTeoricas: string[] = [];
      const dbIdsProvas: string[] = [];

      resultadosToDelete.forEach(groupId => {
        const group = aggregatedResultados.find(g => g.id === groupId);
        if (group) {
          if (group.isTeorica) {
            dbIdsTeoricas.push(group.id);
          } else if (group.isProvaTeorica) {
            dbIdsProvas.push(group.id);
          } else {
            group.avaliacoes.forEach((av: any) => {
              dbIdsPraticas.push(av.id);
            });
          }
        }
      });

      if (dbIdsPraticas.length > 0) {
        const { error } = await supabase.from('avaliacoes').delete().in('id', dbIdsPraticas);
        if (error) throw error;
      }

      if (dbIdsTeoricas.length > 0) {
        const { error } = await supabase.from('avaliacoes_teoricas').delete().in('id', dbIdsTeoricas);
        if (error) throw error;
      }

      if (dbIdsProvas.length > 0) {
        const { error } = await supabase.from('prova_resultados').delete().in('id', dbIdsProvas);
        if (error) throw error;
      }

      showToast('Avaliações excluídas com sucesso!', 'success');
      setSelectedResultados(new Set());
      setResultadosToDelete(null);
      fetchResultados();
    } catch (error) {
      console.error('Erro ao excluir avaliações:', error);
      showToast('Erro ao excluir avaliações.', 'error');
    }
  };

  const handleDeleteResultados = (idsToDelete: string[]) => {
    if (!isUserAdmin(loggedUser)) return;
    setResultadosToDelete(idsToDelete);
  };

  const confirmDeleteTecnicas = async () => {
    if (!tecnicasToDelete || tecnicasToDelete.length === 0) return;
    
    try {
      const { error } = await supabase.from('tecnicas').delete().in('id', tecnicasToDelete);
      if (error) throw error;
      
      setTecnicas(tecnicas.filter(t => !tecnicasToDelete.includes(t.id)));
      showToast('Técnicas excluídas com sucesso!', 'success');
      setSelectedTecnicas(new Set());
      setTecnicasToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir técnicas:', error);
      showToast('Erro ao excluir técnicas.', 'error');
    }
  };

  const handleDeleteTecnicas = (idsToDelete: string[]) => {
    if (!isUserAdmin(loggedUser)) return;
    setTecnicasToDelete(idsToDelete);
  };

  const aggregatedResultados = useMemo(() => {
    const groups: Record<string, any> = {};

    resultados.forEach(res => {
      const key = `${res.candidato_id}_${res.modulo_id}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          created_at: res.created_at,
          candidato_id: res.candidato_id,
          candidato_nome: res.candidato_nome,
          grau_pretendido: res.grau_pretendido,
          modulo_id: res.modulo_id,
          waza_scores: [],
          kata_scores: [],
          vereditos: [],
          avaliacoes: [],
          isTeorica: false
        };
      }
      groups[key].avaliacoes.push(res);
      if (res.percentual_waza !== null && res.percentual_waza !== undefined) {
        groups[key].waza_scores.push(res.percentual_waza);
      }
      if (res.nota_kata !== null && res.nota_kata !== undefined) {
        groups[key].kata_scores.push(res.nota_kata);
      }
      if (res.veredito) {
        groups[key].vereditos.push(res.veredito);
      }
    });

    const praticas = Object.values(groups).map(group => {
      const avgWaza = group.waza_scores.length > 0 
        ? Math.round(group.waza_scores.reduce((a: number, b: number) => a + b, 0) / group.waza_scores.length) 
        : null;
      const avgKata = group.kata_scores.length > 0 
        ? Math.round(group.kata_scores.reduce((a: number, b: number) => a + b, 0) / group.kata_scores.length) 
        : null;
      
      let finalVeredito = 'Pendente';
      const modulo = modulos.find(m => m.id === group.modulo_id);
      const isKatas = modulo?.tema === 'Katas';

      if (isKatas) {
        if (avgKata !== null) {
          if (avgKata >= 70) finalVeredito = 'Aprovado';
          else if (avgKata >= 50) finalVeredito = 'Pendente';
          else finalVeredito = 'Reprovado';
        }
      } else {
        if (avgWaza !== null) {
          if (avgWaza >= 70) finalVeredito = 'Aprovado';
          else if (avgWaza >= 50) finalVeredito = 'Pendente';
          else finalVeredito = 'Reprovado';
        }
      }

      return {
        ...group,
        percentual_waza: avgWaza,
        nota_kata: avgKata,
        veredito: finalVeredito,
        avaliadores_count: group.vereditos.length
      };
    });

    const teoricas = resultadosTeoricos.map(rt => {
      let finalVeredito = 'Pendente';
      if (rt.media !== null && rt.media !== undefined) {
        if (rt.media >= 70) finalVeredito = 'Aprovado';
        else if (rt.media >= 50) finalVeredito = 'Pendente';
        else finalVeredito = 'Reprovado';
      }

      return {
        id: rt.id,
        created_at: rt.data || rt.created_at,
        candidato_id: rt.candidato_id,
        candidato_nome: rt.candidato_nome,
        grau_pretendido: rt.grau_pretendido,
        modulo_id: 'teorica',
        modulo_nome: rt.modulo,
        media_teorica: rt.media,
        veredito: finalVeredito,
        avaliadores_count: 1,
        isTeorica: true,
        avaliacoes: [rt]
      };
    });

    const provas = resultadosProvas.map(rp => {
      let finalVeredito = 'Pendente';
      const percentual = rp.nota * 10; // Convert 0-10 to 0-100%
      if (percentual >= 70) finalVeredito = 'Aprovado';
      else if (percentual >= 50) finalVeredito = 'Pendente';
      else finalVeredito = 'Reprovado';

      const candidato = candidatos.find(c => c.id === rp.candidato_id);

      return {
        id: rp.id,
        created_at: rp.finalizada_em,
        candidato_id: rp.candidato_id,
        candidato_nome: candidato ? candidato.nome : 'Desconhecido',
        grau_pretendido: candidato ? candidato.grau_pretendido : 'Desconhecido',
        modulo_id: 'prova_teorica',
        modulo_nome: rp.provas_teoricas?.titulo || 'Prova Teórica',
        media_teorica: percentual,
        veredito: finalVeredito,
        avaliadores_count: 1,
        isProvaTeorica: true,
        avaliacoes: [rp]
      };
    });

    return [...praticas, ...teoricas, ...provas].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [resultados, resultadosTeoricos, resultadosProvas, modulos, candidatos]);

  const filteredResultados = useMemo(() => {
    return aggregatedResultados.filter(res => {
      const candidato = candidatos.find(c => c.id === res.candidato_id);
      const modulo = modulos.find(m => m.id === res.modulo_id);
      const nomeCandidato = candidato ? candidato.nome : res.candidato_nome || 'Desconhecido';
      const temaModulo = res.isTeorica || res.isProvaTeorica ? res.modulo_nome : (modulo ? (modulo.nome || modulo.tema) : 'Desconhecido');

      if (filtroModulo && temaModulo !== filtroModulo) return false;
      if (filtroGrau && res.grau_pretendido !== filtroGrau) return false;
      if (filtroCandidato && !nomeCandidato.toLowerCase().includes(filtroCandidato.toLowerCase())) return false;
      if (filtroResultado && res.veredito !== filtroResultado) return false;
      
      return true;
    });
  }, [aggregatedResultados, filtroModulo, filtroGrau, filtroCandidato, filtroResultado, candidatos, modulos]);

  const handlePrintResult = async (group: any) => {
    const candidato = candidatos.find(c => c.id === group.candidato_id);
    const modulo = modulos.find(m => m.id === group.modulo_id);
    const nomeCandidato = candidato ? candidato.nome : group.candidato_nome || 'Desconhecido';
    const temaModulo = modulo ? (modulo.nome || modulo.tema) : 'Desconhecido';
    const isKatas = modulo?.tema === 'Katas';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Permita pop-ups para gerar o PDF.', 'error');
      return;
    }

    printWindow.document.write('<html><head><title>Carregando...</title></head><body><p>Gerando relatório, por favor aguarde...</p></body></html>');
    printWindow.document.close();

    try {
      const { supabase } = await import('./lib/supabase');
      const avaliacaoIds = group.avaliacoes.map((a: any) => a.id);

      let wazaDetails: any[] = [];
      let kihonDetails: any[] = [];
      let kataDetails: any[] = [];
      let highDanDetails: any[] = [];

      if (avaliacaoIds.length > 0) {
        if (!isKatas) {
          const { data: wazaData } = await supabase.from('avaliacao_waza').select('*').in('avaliacao_id', avaliacaoIds);
          wazaDetails = wazaData || [];
          
          const { data: kihonData } = await supabase.from('avaliacao_kihon').select('*').in('avaliacao_id', avaliacaoIds);
          kihonDetails = kihonData || [];
          
          const { data: hdData } = await supabase.from('avaliacao_alta_graduacao').select('*').in('avaliacao_id', avaliacaoIds);
          highDanDetails = hdData || [];
        } else {
          const { data: kataData } = await supabase.from('avaliacao_kata').select('*').in('avaliacao_id', avaliacaoIds);
          kataDetails = kataData || [];
        }
      }

      const groupedWaza: Record<string, any[]> = {};
      wazaDetails.forEach(w => {
        if (!groupedWaza[w.tecnica_nome]) groupedWaza[w.tecnica_nome] = [];
        groupedWaza[w.tecnica_nome].push(w);
      });

      const groupedKihon: Record<string, any[]> = {};
      kihonDetails.forEach(k => {
        if (!groupedKihon[k.kihon_nome]) groupedKihon[k.kihon_nome] = [];
        groupedKihon[k.kihon_nome].push(k);
      });

      const groupedKata: Record<string, any[]> = {};
      kataDetails.forEach(k => {
        if (!groupedKata[k.kata_nome]) groupedKata[k.kata_nome] = [];
        groupedKata[k.kata_nome].push(k);
      });

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Resultado - ${nomeCandidato}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.5; }
              h1 { color: #b91c1c; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; }
              h2 { color: #475569; margin-top: 30px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
              .header-info { margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
              .header-info p { margin: 5px 0; }
              .evaluator-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; page-break-inside: avoid; background: #fff; }
              .evaluator-title { font-weight: bold; font-size: 1.1em; margin-bottom: 10px; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
              .field { margin-bottom: 8px; }
              .label { font-weight: bold; color: #64748b; }
              .value { color: #0f172a; }
              .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.85em; font-weight: bold; }
              .badge.Aprovado { background: #dcfce7; color: #166534; }
              .badge.Reprovado { background: #fee2e2; color: #991b1b; }
              .badge.Pendente { background: #fef3c7; color: #92400e; }
              ul { margin-top: 5px; margin-bottom: 5px; padding-left: 20px; }
              .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; page-break-inside: auto; }
              .details-table tr { page-break-inside: avoid; page-break-after: auto; }
              .details-table th, .details-table td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
              .details-table th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
              .details-table th.col-tecnica, .details-table th.col-criterio { text-align: left; }
              .details-table td.col-tecnica { text-align: left; background-color: #f8fafc; }
              .details-table td.col-criterio { text-align: left; font-style: italic; color: #64748b; }
              .details-table td.col-avaliador { text-align: center; }
              @media print {
                body { padding: 0; }
                .header-info { background: none; border: none; padding: 0; }
                .evaluator-card { border: 1px solid #ccc; }
              }
            </style>
          </head>
          <body>
            <h1>Relatório de Avaliação de Exame de Graduação</h1>
            
            <div class="header-info">
              <p><span class="label">Candidato:</span> <span class="value">${nomeCandidato}</span></p>
              <p><span class="label">Grau Pretendido:</span> <span class="value">${group.grau_pretendido}</span></p>
              <p><span class="label">Módulo:</span> <span class="value">${temaModulo}</span></p>
              <p><span class="label">Data:</span> <span class="value">${group.created_at.includes('T') ? new Date(group.created_at).toLocaleDateString('pt-BR') : group.created_at.split('-').reverse().join('/')}</span></p>
              <p><span class="label">Resultado Final:</span> <span class="badge ${group.veredito}">${group.veredito}</span></p>
              <p><span class="label">Média:</span> <span class="value">${isKatas ? (group.nota_kata !== null ? group.nota_kata + '%' : '-') : (group.percentual_waza !== null ? group.percentual_waza + '%' : '-')}</span></p>
            </div>

            <h2>Detalhamento por Avaliador</h2>
            ${group.avaliacoes.map((av: any, index: number) => {
              const parseJsonArray = (val: any) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val); } catch (e) { return []; }
              };
              
              const motivos = parseJsonArray(av.motivos_pendencia);
              const observacoes = parseJsonArray(av.observacoes_pedagogicas);
              const errosKata = parseJsonArray(av.erros_kata);

              return `
              <div class="evaluator-card">
                <div class="evaluator-title">Avaliador ${index + 1} (${av.avaliador_nome || 'Desconhecido'})</div>
                <div class="field"><span class="label">Veredito:</span> <span class="badge ${av.veredito}">${av.veredito}</span></div>
                ${!isKatas && av.percentual_waza !== null && av.percentual_waza !== undefined ? `<div class="field"><span class="label">Nota Waza:</span> <span class="value">${av.percentual_waza}%</span></div>` : ''}
                ${isKatas && av.nota_kata !== null && av.nota_kata !== undefined ? `<div class="field"><span class="label">Nota Kata:</span> <span class="value">${av.nota_kata}%</span></div>` : ''}
                
                ${av.sugestao_estudo ? `<div class="field"><span class="label">Sugestão de Estudo:</span> <div class="value">${av.sugestao_estudo}</div></div>` : ''}
                ${motivos.length > 0 ? `<div class="field"><span class="label">Motivos de Pendência:</span> <ul class="value">${motivos.map((m: string) => `<li>${m}</li>`).join('')}</ul></div>` : ''}
                ${observacoes.length > 0 ? `<div class="field"><span class="label">Observações Pedagógicas:</span> <ul class="value">${observacoes.map((o: string) => `<li>${o}</li>`).join('')}</ul></div>` : ''}
                ${errosKata.length > 0 ? `<div class="field"><span class="label">Erros Kata:</span> <ul class="value">${errosKata.map((e: string) => `<li>${e}</li>`).join('')}</ul></div>` : ''}
              </div>
            `}).join('')}

            <h2>Detalhamento por Técnica</h2>
            <table class="details-table">
              <thead>
                <tr>
                  <th class="col-tecnica">Técnica</th>
                  <th class="col-criterio">Critério</th>
                  ${group.avaliacoes.map((av: any, index: number) => `<th class="col-avaliador">Avaliador ${index + 1}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                <!-- Waza Rows -->
                ${Object.keys(groupedWaza).map(tecnica => {
                  const evals = groupedWaza[tecnica];
                  return `
                    <tr>
                      <td rowspan="3" class="col-tecnica"><strong>${tecnica}</strong></td>
                      <td class="col-criterio">Kuzushi</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.kuzushi : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Tsukuri</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.tsukuri : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Kake</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.kake : '-'}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
                
                <!-- Kihon Rows -->
                ${group.tema !== 'Katas' ? Object.keys(groupedKihon).map(kihon => {
                  const evals = groupedKihon[kihon];
                  return `
                    <tr>
                      <td class="col-tecnica"><strong>${kihon}</strong></td>
                      <td class="col-criterio">Status</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.status : '-'}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('') : ''}

                <!-- Kata Rows -->
                ${Object.keys(groupedKata).map(kata => {
                  const evals = groupedKata[kata];
                  return `
                    <tr>
                      <td rowspan="4" class="col-tecnica"><strong>${kata}</strong></td>
                      <td class="col-criterio">Erros Pequenos</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.small_errors : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Erros Médios</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.medium_errors : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Erros Graves</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.grave_errors : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Omitida</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = evals.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? (evalData.omitted ? 'Sim' : 'Não') : '-'}</td>`;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}

                <!-- High Dan Rows -->
                ${highDanDetails.length > 0 ? `
                    <tr>
                      <td rowspan="3" class="col-tecnica"><strong>Critérios Alta Graduação</strong></td>
                      <td class="col-criterio">Criatividade</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = highDanDetails.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.criatividade : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Inovação</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = highDanDetails.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.inovacao : '-'}</td>`;
                      }).join('')}
                    </tr>
                    <tr>
                      <td class="col-criterio">Eficiência</td>
                      ${group.avaliacoes.map((av: any) => {
                        const evalData = highDanDetails.find(e => e.avaliacao_id === av.id);
                        return `<td class="col-avaliador">${evalData ? evalData.eficiencia : '-'}</td>`;
                      }).join('')}
                    </tr>
                ` : ''}
              </tbody>
            </table>
            
            <script>
              window.onload = () => {
                window.print();
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      printWindow.close();
      showToast('Erro ao carregar detalhes para o PDF.', 'error');
    }
  };

  // --- Login Handler ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanZempo = loginZempo.trim();
    const cleanSenha = senhaZempo.trim();

    if (!cleanZempo || !cleanSenha) {
      setLoginError('Preencha ambos os campos.');
      return;
    }

    try {
      const { supabase } = await import('./lib/supabase');

      // Check avaliadores
      const { data: avaliadorData, error: avaliadorError } = await supabase
        .from('avaliadores')
        .select('*')
        .ilike('zempo', cleanZempo)
        .maybeSingle();

      if (avaliadorData) {
        // Se o avaliador não tem senha cadastrada no banco, a senha inicial é o próprio Zempo
        const isFirstAccess = !avaliadorData.senha;
        const senhaCorreta = avaliadorData.senha || avaliadorData.zempo?.trim();
        if (cleanSenha === senhaCorreta) {
          setLoggedUser(avaliadorData);
          setLoggedRole('avaliador');
          setSelectedAvaliadorId(avaliadorData.id);
          setLoginError('');
          if (isFirstAccess) {
            setRequirePasswordChange(true);
          }
        } else {
          setLoginError('Senha incorreta.');
        }
        return;
      }

      // Check candidatos
      const { data: candidatoData, error: candidatoError } = await supabase
        .from('candidatos')
        .select('*')
        .ilike('zempo', cleanZempo)
        .maybeSingle();

      if (candidatoData) {
        // Se o candidato não tem senha cadastrada no banco, a senha inicial é o próprio Zempo
        const isFirstAccess = !candidatoData.senha;
        const senhaCorreta = candidatoData.senha || candidatoData.zempo?.trim();
        if (cleanSenha === senhaCorreta) {
          setLoggedUser(candidatoData);
          setLoggedRole('candidato');
          setMainTab('resultados');
          setLoginError('');
          if (isFirstAccess) {
            setRequirePasswordChange(true);
          }
        } else {
          setLoginError('Senha incorreta.');
        }
        return;
      }

      setLoginError('Usuário não encontrado com este Zempo.');
    } catch (error: any) {
      console.error('Erro no login:', error);
      setLoginError('Erro ao realizar login. Tente novamente.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('As senhas não conferem.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordChangeError('');

    try {
      const { supabase } = await import('./lib/supabase');
      const table = loggedRole === 'avaliador' ? 'avaliadores' : 'candidatos';

      const { error } = await supabase
        .from(table)
        .update({ senha: newPassword })
        .eq('id', loggedUser!.id);

      if (error) throw error;

      setLoggedUser({ ...loggedUser!, senha: newPassword });
      if (loggedRole === 'avaliador') {
        setAvaliadores(prev => prev.map(a => a.id === loggedUser!.id ? { ...a, senha: newPassword } : a));
      } else {
        setCandidatos(prev => prev.map(c => c.id === loggedUser!.id ? { ...c, senha: newPassword } : c));
      }
      
      setRequirePasswordChange(false);
      showToast('Senha atualizada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error);
      setPasswordChangeError(`Erro ao atualizar: ${error.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    setLoggedUser(null);
    setLoggedRole(null);
    setLoginZempo('');
    setSenhaZempo('');
    setSelectedAvaliadorId('');
    setSelectedModuloId('');
    setMainTab('avaliacao');
  };

  const handleSaveModulo = async () => {
    if (!newModulo.data || !newModulo.tema) {
      showToast('Data e Tema são obrigatórios.', 'error');
      return;
    }
    try {
      if (editingModuloId) {
        const { data, error } = await supabase.from('modulos_avaliacao').update(newModulo).eq('id', editingModuloId).select();
        if (error) throw error;
        if (data) {
          setModulos(modulos.map(m => m.id === editingModuloId ? data[0] : m));
          setIsCreatingModulo(false);
          setEditingModuloId(null);
          setNewModulo({ avaliadores_ids: [], coordenadores_ids: [] });
          showToast('Módulo atualizado com sucesso!', 'success');
        }
      } else {
        const { data, error } = await supabase.from('modulos_avaliacao').insert([newModulo]).select();
        if (error) throw error;
        if (data) {
          setModulos([...modulos, data[0]]);
          setIsCreatingModulo(false);
          setNewModulo({ avaliadores_ids: [], coordenadores_ids: [] });
          showToast('Módulo criado com sucesso!', 'success');
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar módulo:', error);
      showToast(`Erro ao salvar módulo: ${error.message}`, 'error');
    }
  };

  // --- Handlers de Cadastro (CSV e Manual) ---
  const handleImportCandidatos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.replace(/[,;]/g, '').trim().length > 0);
      if (lines.length < 2) return alert('CSV inválido ou vazio. Certifique-se de ter um cabeçalho.');
      
      const newCandidatos = lines.slice(1).map(line => {
        const [nome, grau, dojo, zempo] = line.split(/[,;]/).map(v => v?.trim() || '');
        
        let parsedGrau: Dan = 'Shodan (1º Dan)';
        const grauUpper = grau.toUpperCase();
        if (grauUpper.includes('1') || grauUpper.includes('SHODAN')) parsedGrau = 'Shodan (1º Dan)';
        else if (grauUpper.includes('2') || grauUpper.includes('NIDAN')) parsedGrau = 'Nidan (2º Dan)';
        else if (grauUpper.includes('3') || grauUpper.includes('SANDAN')) parsedGrau = 'Sandan (3º Dan)';
        else if (grauUpper.includes('4') || grauUpper.includes('YONDAN')) parsedGrau = 'Yondan (4º Dan)';
        else if (grauUpper.includes('5') || grauUpper.includes('GODAN')) parsedGrau = 'Godan (5º Dan)';

        return {
          nome: nome || 'Sem Nome',
          grau_pretendido: parsedGrau,
          dojo: dojo || '',
          zempo: zempo || ''
        };
      }).filter(c => c.nome !== 'Sem Nome' || c.dojo !== '' || c.zempo !== '');

      if (newCandidatos.length === 0) return alert('Nenhum candidato válido encontrado no CSV.');

      const { data, error } = await supabase.from('candidatos').insert(newCandidatos).select();
      if (error) {
        alert(`Erro ao importar: ${error.message}`);
      } else if (data) {
        setCandidatos(prev => [...prev, ...data].sort((a, b) => a.nome.localeCompare(b.nome)));
        alert(`${data.length} candidatos importados com sucesso!`);
      }
      if (fileInputCandidatosRef.current) fileInputCandidatosRef.current.value = '';
    };
    // Lê como UTF-8 (padrão) para evitar problemas com arquivos do Mac
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportAvaliadores = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.replace(/[,;]/g, '').trim().length > 0);
      if (lines.length < 2) return alert('CSV inválido ou vazio. Certifique-se de ter um cabeçalho.');
      
      const newAvaliadores = lines.slice(1).map(line => {
        const [nome, graduacao, zempo, funcao] = line.split(/[,;]/).map(v => v?.trim() || '');
        return {
          nome: nome || 'Sem Nome',
          graduacao: graduacao || '1º Dan',
          zempo: zempo || '',
          funcao: funcao || 'avaliador'
        };
      }).filter(a => a.nome !== 'Sem Nome' || a.graduacao !== '1º Dan');

      if (newAvaliadores.length === 0) return alert('Nenhum avaliador válido encontrado no CSV.');

      const { data, error } = await supabase.from('avaliadores').insert(newAvaliadores).select();
      if (error) {
        alert(`Erro ao importar: ${error.message}`);
      } else if (data) {
        setAvaliadores(prev => [...prev, ...data].sort((a, b) => a.nome.localeCompare(b.nome)));
        alert(`${data.length} avaliadores importados com sucesso!`);
      }
      if (fileInputAvaliadoresRef.current) fileInputAvaliadoresRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportFromTreinamento = async () => {
    try {
      const { data: participantes, error } = await supabase.from('treinamento_participantes').select('*');
      if (error) throw error;
      
      if (!participantes || participantes.length === 0) {
        return alert('Nenhum participante encontrado nos treinamentos.');
      }

      const existingNames = new Set(avaliadores.map(a => a.nome.toLowerCase().trim()));
      
      // Get unique participants by name
      const uniqueParticipantesMap = new Map();
      participantes.forEach(p => {
        const nameKey = p.nome.toLowerCase().trim();
        if (!uniqueParticipantesMap.has(nameKey)) {
          uniqueParticipantesMap.set(nameKey, {
            ...p,
            graduacao: '1º Dan'
          });
        } else if (p.is_coordenador) {
          // Prefer coordinator role if duplicate exists
          uniqueParticipantesMap.set(nameKey, {
            ...p,
            graduacao: '1º Dan'
          });
        }
      });
      
      const uniqueParticipantes = Array.from(uniqueParticipantesMap.values())
        .filter(p => !existingNames.has(p.nome.toLowerCase().trim()));

      if (uniqueParticipantes.length === 0) {
        return alert('Todos os participantes dos treinamentos já estão cadastrados como avaliadores.');
      }

      setTreinamentoParticipants(uniqueParticipantes);
      setSelectedParticipants(new Set(uniqueParticipantes.map(p => p.id))); // Select all by default
      setIsImportTreinamentoModalOpen(true);
    } catch (err: any) {
      console.error('Erro ao buscar participantes do treinamento:', err);
      alert(`Erro ao buscar participantes: ${err.message}`);
    }
  };

  const confirmImportFromTreinamento = async () => {
    const selected = treinamentoParticipants.filter(p => selectedParticipants.has(p.id));
    if (selected.length === 0) {
      return alert('Selecione pelo menos um participante para importar.');
    }

    const newAvaliadores = selected.map(p => ({
      nome: p.nome,
      graduacao: p.graduacao,
      zempo: p.zempo || '',
      funcao: p.is_coordenador ? 'coordenador' : 'avaliador'
    }));

    try {
      const { data, error: insertError } = await supabase.from('avaliadores').insert(newAvaliadores).select();
      if (insertError) throw insertError;

      if (data) {
        setAvaliadores(prev => [...prev, ...data].sort((a, b) => a.nome.localeCompare(b.nome)));
        alert(`${data.length} avaliadores importados dos treinamentos com sucesso!`);
        setIsImportTreinamentoModalOpen(false);
      }
    } catch (err: any) {
      console.error('Erro ao importar do treinamento:', err);
      alert(`Erro ao importar: ${err.message}`);
    }
  };

  const handleImportKatas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.replace(/[,;]/g, '').trim().length > 0);
      if (lines.length < 2) return alert('CSV inválido ou vazio. Certifique-se de ter um cabeçalho.');
      
      const newKatas = lines.slice(1).map(line => {
        const delimiter = line.includes(';') ? ';' : ',';
        const [nome, ordemStr, grupo] = line.split(delimiter).map(v => v?.trim() || '');
        return {
          nome: nome || 'Sem Nome',
          ordem: parseInt(ordemStr) || 0,
          grupo: grupo || 'Geral'
        };
      }).filter(k => k.nome !== 'Sem Nome' || k.grupo !== 'Geral');

      if (newKatas.length === 0) return alert('Nenhum kata válido encontrado no CSV.');

      const { data, error } = await supabase.from('katas').insert(newKatas).select();
      if (error) {
        alert(`Erro ao importar: ${error.message}`);
      } else if (data) {
        setKatas(prev => [...prev, ...data].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.ordem - b.ordem));
        alert(`${data.length} técnicas de kata importadas com sucesso!`);
      }
      if (fileInputKatasRef.current) fileInputKatasRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const addManualCandidato = async () => {
    const { data, error } = await supabase.from('candidatos').insert([{ nome: '', grau_pretendido: 'Shodan (1º Dan)', dojo: '', zempo: '' }]).select();
    if (data && !error) setCandidatos([...candidatos, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const handleImportTecnicas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.replace(/[,;]/g, '').trim().length > 0);
      if (lines.length < 2) return alert('CSV inválido ou vazio. Certifique-se de ter um cabeçalho.');
      
      const newTecnicas = lines.slice(1).map(line => {
        const [nome, grupo, tipo] = line.split(/[,;]/).map(v => v?.trim() || '');
        return {
          nome: nome || 'Sem Nome',
          grupo: grupo || 'Geral',
          tipo: tipo || ''
        };
      }).filter(t => t.nome !== 'Sem Nome' || t.grupo !== 'Geral');

      if (newTecnicas.length === 0) return alert('Nenhuma técnica válida encontrada no CSV.');

      const { data, error } = await supabase.from('tecnicas').insert(newTecnicas).select();
      if (error) {
        alert(`Erro ao importar: ${error.message}`);
      } else if (data) {
        setTecnicas(prev => [...prev, ...data].sort((a, b) => a.nome.localeCompare(b.nome)));
        alert(`${data.length} técnicas importadas com sucesso!`);
      }
      if (fileInputTecnicasRef.current) fileInputTecnicasRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const addManualAvaliador = async () => {
    const { data, error } = await supabase.from('avaliadores').insert([{ nome: '', graduacao: '1º Dan', zempo: '', funcao: 'avaliador' }]).select();
    if (data && !error) setAvaliadores([...avaliadores, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const addManualTecnica = async () => {
    const { data, error } = await supabase.from('tecnicas').insert([{ nome: '', grupo: 'Te-waza', tipo: '' }]).select();
    if (data && !error) setTecnicas([...tecnicas, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const addManualKata = async () => {
    const { data, error } = await supabase.from('katas').insert([{ nome: '', ordem: 1, grupo: 'Nage-no-Kata' }]).select();
    if (data && !error) setKatas([...katas, data[0]].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.ordem - b.ordem));
  };

  // --- Handlers de Atualização e Exclusão no Supabase ---
  const updateCandidatoDB = async (id: string, field: keyof Candidato, value: string) => {
    const { error } = await supabase.from('candidatos').update({ [field]: value }).eq('id', id);
    if (error) console.error("Erro ao atualizar candidato:", error);
  };

  const deleteCandidato = async (id: string) => {
    const { error } = await supabase.from('candidatos').delete().eq('id', id);
    if (!error) setCandidatos(candidatos.filter(c => c.id !== id));
    else alert(`Erro ao excluir: ${error.message}`);
  };

  const updateAvaliadorDB = async (id: string, field: keyof Avaliador, value: string) => {
    const { error } = await supabase.from('avaliadores').update({ [field]: value }).eq('id', id);
    if (error) console.error("Erro ao atualizar avaliador:", error);
  };

  const deleteAvaliador = async (id: string) => {
    const { error } = await supabase.from('avaliadores').delete().eq('id', id);
    if (!error) setAvaliadores(avaliadores.filter(a => a.id !== id));
    else alert(`Erro ao excluir: ${error.message}`);
  };

  const updateTecnicaDB = async (id: string, field: keyof Tecnica, value: string) => {
    const { error } = await supabase.from('tecnicas').update({ [field]: value }).eq('id', id);
    if (error) console.error("Erro ao atualizar técnica:", error);
  };

  const deleteTecnica = async (id: string) => {
    const { error } = await supabase.from('tecnicas').delete().eq('id', id);
    if (!error) setTecnicas(tecnicas.filter(t => t.id !== id));
    else alert(`Erro ao excluir: ${error.message}`);
  };

  const updateKataDB = async (id: string, field: keyof KataDef, value: string | number) => {
    const { error } = await supabase.from('katas').update({ [field]: value }).eq('id', id);
    if (!error) {
      setKatas(prev => {
        const updated = prev.map(k => k.id === id ? { ...k, [field]: value } : k);
        return updated.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.ordem - b.ordem);
      });
    }
  };

  const deleteKata = async (id: string) => {
    const { error } = await supabase.from('katas').delete().eq('id', id);
    if (!error) setKatas(katas.filter(k => k.id !== id));
    else alert(`Erro ao excluir: ${error.message}`);
  };

  const downloadCSVTemplate = (type: 'candidatos' | 'avaliadores' | 'tecnicas' | 'katas') => {
    let content = '';
    let filename = '';
    
    if (type === 'candidatos') {
      content = 'nome, grau_pretendido, dojo, zempo\nJoão Silva, Shodan (1º Dan), Associação de Judô, 123456\nMaria Souza, Nidan (2º Dan), Clube Central, 654321\n';
      filename = 'modelo_candidatos.csv';
    } else if (type === 'avaliadores') {
      content = 'nome, graduacao, zempo, funcao\nSensei Tanaka, 6º Dan, 111111, gestor\nSensei Oliveira, 5º Dan, 222222, avaliador\n';
      filename = 'modelo_avaliadores.csv';
    } else if (type === 'tecnicas') {
      content = 'nome, grupo, tipo\nIppon Seoi Nage, Te-waza, Nage-waza\nUchi Mata, Koshi-waza, Nage-waza\nO Soto Gari, Ashi-waza, Nage-waza\n';
      filename = 'modelo_tecnicas.csv';
    } else if (type === 'katas') {
      content = 'Nome da Técnica;Ordem;Kata\nUki-otoshi;1;Nage-no-Kata (Te-waza)\nSeoi-nage;2;Nage-no-Kata (Te-waza)\n';
      filename = 'modelo_katas.csv';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Helpers de Avaliação ---
  const activeCandidato = candidatos.find(c => c.id === selectedCandidatoId);
  const activeAvaliador = avaliadores.find(a => a.id === selectedAvaliadorId);
  
  const finalCandidateName = activeCandidato ? activeCandidato.nome : manualCandidateName;
  const finalTargetDan = activeCandidato ? activeCandidato.grau_pretendido : targetDan;
  const isHighDan = finalTargetDan.includes('4') || finalTargetDan.includes('5') || finalTargetDan.includes('Yondan') || finalTargetDan.includes('Godan');

  const addWaza = () => {
    const defaultStatus = 'AVALIAR';
    setWazaList([...wazaList, { id: Math.random().toString(36).substr(2, 9), name: '', kuzushi: defaultStatus as PhaseStatus, tsukuri: defaultStatus as PhaseStatus, kake: defaultStatus as PhaseStatus }]);
  };
  const updateWaza = (id: string, field: keyof Waza, value: string) => {
    setWazaList(wazaList.map(w => w.id === id ? { ...w, [field]: value } : w));
  };
  
  const handleFullscreenEval = (id: string, field: keyof Waza, value: string) => {
    setWazaList(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    
    const currentWazaIndex = wazaList.findIndex(w => w.id === id);
    const currentWaza = wazaList[currentWazaIndex];
    
    // Auto-advance tabs or next waza
    if (field === 'kuzushi') {
      setTimeout(() => setFullscreenActiveTab('tsukuri'), 300);
    } else if (field === 'tsukuri') {
      setTimeout(() => setFullscreenActiveTab('kake'), 300);
    } else if (field === 'kake') {
      if (currentWaza && currentWaza.kuzushi !== 'AVALIAR' && currentWaza.tsukuri !== 'AVALIAR') {
        setTimeout(() => {
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'waza_evaluated',
              payload: { avaliadorId: loggedUser?.id, index: currentWazaIndex }
            });
          }
        }, 400);
      }
    }
  };

  const removeWaza = (id: string) => setWazaList(wazaList.filter(w => w.id !== id));

  const updateKihon = (id: string, value: PhaseStatus) => {
    setKihonList(prev => prev.map(k => k.id === id ? { ...k, status: value } : k));
  };

  const sortearTecnicas = useCallback(() => {
    if (!selectedTema || selectedTema === 'Katas') {
      return;
    }
    if (quantidadeSorteio <= 0) {
      return;
    }

    const normalizeString = (str: string) => str.toLowerCase().replace(/[- ]/g, '');
    const isShodan = finalTargetDan.includes('1º Dan') || finalTargetDan.includes('Shodan');
    const isNidan = finalTargetDan.includes('2º Dan') || finalTargetDan.includes('Nidan');
    const gokyoGroups = ['Koshi-waza', 'Ashi-waza', 'Te-waza', 'Sutemi-waza (Yoko)', 'Sutemi-waza (Ma)'].map(normalizeString);

    const temas = selectedTema.split(',').map(t => t.trim()).filter(t => t);
    
    let selecionadas: Tecnica[] = [];
    
    const baseCount = Math.floor(quantidadeSorteio / temas.length);
    let remainder = quantidadeSorteio % temas.length;

    for (const tema of temas) {
      const normalizedTema = normalizeString(tema);
      let tecnicasDoTema = tecnicas.filter(t => {
        const normT = normalizeString(t.grupo);
        return normT === normalizedTema || normT.startsWith(normalizedTema);
      });

      const isGokyoGroup = gokyoGroups.some(g => g === normalizedTema || g.startsWith(normalizedTema));

      if (isShodan && isGokyoGroup) {
        tecnicasDoTema = tecnicasDoTema.filter(t => t.tipo && t.tipo.includes('(Gokyo)'));
        if (tecnicasDoTema.length === 0) {
          showToast(`Nenhuma técnica contendo (Gokyo) no tipo encontrada para o tema: ${tema}`, 'error');
          continue;
        }
      }

      if (tecnicasDoTema.length === 0) {
        showToast(`Nenhuma técnica encontrada para o tema: ${tema}`, 'error');
        continue;
      }

      let qtdParaSortear = baseCount + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      if (isNidan && isGokyoGroup) {
        const extraGokyo = tecnicasDoTema.filter(t => t.tipo && t.tipo.trim() === 'Extra-Gokyo');
        const others = tecnicasDoTema.filter(t => !(t.tipo && t.tipo.trim() === 'Extra-Gokyo'));
        
        const shuffledExtra = [...extraGokyo].sort(() => 0.5 - Math.random());
        const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
        
        selecionadas.push(...[...shuffledExtra, ...shuffledOthers].slice(0, qtdParaSortear));
      } else {
        const shuffled = [...tecnicasDoTema].sort(() => 0.5 - Math.random());
        selecionadas.push(...shuffled.slice(0, qtdParaSortear));
      }
    }

    const defaultStatus = 'AVALIAR';
    const novasWazas: Waza[] = selecionadas.map(t => ({
      id: Math.random().toString(36).substr(2, 9),
      name: t.nome,
      kuzushi: defaultStatus as PhaseStatus,
      tsukuri: defaultStatus as PhaseStatus,
      kake: defaultStatus as PhaseStatus
    }));

    setWazaList(novasWazas);
  }, [selectedTema, quantidadeSorteio, tecnicas, finalTargetDan, showToast]);

  useEffect(() => {
    // If clearing the candidate, just reset
    if (selectedCandidatoId === '') {
      setShowReport(false);
      setHighDanEval({ creativity: '', innovation: '', efficiency: '' });
      setKihonList([
        { id: 'kihon-1', name: 'Rei (Saudação)', status: 'AVALIAR' },
        { id: 'kihon-2', name: 'Kumi kata (Pegada)', status: 'AVALIAR' },
        { id: 'kihon-3', name: 'Shintai (Deslocamento)', status: 'AVALIAR' }
      ]);
      setKataList([]);
      setWazaList([]);
      cacheLoadedRef.current = null;
      return;
    }

    // Try to load from cache
    if (selectedModuloId && loggedUser) {
      const cacheKey = `eval_cache_${selectedModuloId}_${selectedCandidatoId}_${loggedUser.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Only restore if it's from the last 12 hours
          if (new Date().getTime() - parsed.timestamp < 12 * 60 * 60 * 1000) {
            if (cacheLoadedRef.current !== cacheKey) {
              // Merge wazaList
              if (parsed.wazaList && parsed.wazaList.length > 0) {
                setWazaList(current => {
                  if (current.length === 0) return parsed.wazaList;
                  return current.map(w => {
                    const cachedWaza = parsed.wazaList.find((cw: any) => cw.name === w.name);
                    return cachedWaza ? { ...w, kuzushi: cachedWaza.kuzushi, tsukuri: cachedWaza.tsukuri, kake: cachedWaza.kake } : w;
                  });
                });
              }
              // Merge kataList
              if (parsed.kataList && parsed.kataList.length > 0) {
                setKataList(current => {
                  if (current.length === 0) return parsed.kataList;
                  return current.map(k => {
                    const cachedKata = parsed.kataList.find((ck: any) => ck.name === k.name);
                    return cachedKata ? { ...k, smallErrors: cachedKata.smallErrors, mediumErrors: cachedKata.mediumErrors, graveErrors: cachedKata.graveErrors, omitted: cachedKata.omitted, evaluated: cachedKata.evaluated } : k;
                  });
                });
              }
              // Merge kihonList
              if (parsed.kihonList && parsed.kihonList.length > 0) {
                setKihonList(current => {
                  if (current.length === 0) return parsed.kihonList;
                  return current.map(k => {
                    const cachedKihon = parsed.kihonList.find((ck: any) => ck.name === k.name);
                    return cachedKihon ? { ...k, status: cachedKihon.status } : k;
                  });
                });
              }
              if (parsed.highDanEval) setHighDanEval(parsed.highDanEval);
              
              setShowReport(false);
              showToast('Avaliação recuperada do modo offline.', 'info');
              cacheLoadedRef.current = cacheKey;
            }
            return; // Exit early, do not reset or draw
          }
        } catch (e) {
          console.error("Failed to parse cache", e);
        }
      }
    }

    // If no cache or cache expired, reset and draw (if coordinator)
    setShowReport(false);
    setHighDanEval({ creativity: '', innovation: '', efficiency: '' });
    setKihonList([
      { id: 'kihon-1', name: 'Rei (Saudação)', status: 'AVALIAR' },
      { id: 'kihon-2', name: 'Kumi kata (Pegada)', status: 'AVALIAR' },
      { id: 'kihon-3', name: 'Shintai (Deslocamento)', status: 'AVALIAR' }
    ]);
    setKataList([]);
    
    if (isCoordinator && selectedTema && quantidadeSorteio > 0) {
      if (selectedTema === 'Katas') {
        setWazaList([]);
      } else {
        sortearTecnicas();
      }
    } else {
      setWazaList([]);
    }
  }, [selectedCandidatoId, targetDan, selectedTema, quantidadeSorteio, sortearTecnicas, isCoordinator, selectedModuloId, loggedUser, showToast]);

  const generateKataEvaluation = (group: string, mode: 'completo' | 'serie') => {
    if (!group) {
      return;
    }

    // Filtrar técnicas cujo nome base do grupo corresponde ao Kata selecionado
    let tecnicasDoKata = katas.filter(k => k.grupo.split('(')[0].trim() === group);
    
    if (tecnicasDoKata.length === 0) {
      showToast(`Nenhuma técnica encontrada para o Kata: ${group}`, 'error');
      return;
    }

    if (mode === 'serie') {
      // Extrair todas as séries (o que está entre parênteses no grupo)
      const seriesSet = new Set<string>();
      tecnicasDoKata.forEach(t => {
        const match = t.grupo.match(/\(([^)]+)\)/);
        if (match) seriesSet.add(match[1]);
      });

      const series = Array.from(seriesSet);
      if (series.length > 0) {
        // Sortear uma série
        const randomSerie = series[Math.floor(Math.random() * series.length)];
        tecnicasDoKata = tecnicasDoKata.filter(t => t.grupo.includes(`(${randomSerie})`));
        showToast(`Série sorteada: ${randomSerie}`, 'info');
      } else {
        showToast('Nenhuma série (texto entre parênteses) encontrada neste Kata. Avaliando todas as técnicas.', 'info');
      }
    }

    // Ordenar por ordem
    tecnicasDoKata.sort((a, b) => a.ordem - b.ordem);

    const newKataList: KataTechnique[] = [];
    
    // Adicionar Cerimonial de Início
    newKataList.push({
      id: Math.random().toString(36).substr(2, 9),
      name: 'Cerimonial de Ínicio',
      smallErrors: 0,
      mediumErrors: 0,
      graveErrors: 0,
      omitted: false
    });

    // Adicionar Técnicas
    tecnicasDoKata.forEach(t => {
      newKataList.push({
        id: Math.random().toString(36).substr(2, 9),
        name: t.nome,
        smallErrors: 0,
        mediumErrors: 0,
        graveErrors: 0,
        omitted: false
      });
    });

    // Adicionar Cerimonial de Encerramento
    newKataList.push({
      id: Math.random().toString(36).substr(2, 9),
      name: 'Cerimonial de Encerramento',
      smallErrors: 0,
      mediumErrors: 0,
      graveErrors: 0,
      omitted: false
    });

    setKataList(newKataList);
  };

  const addKata = () => {
    setKataList([...kataList, { id: Math.random().toString(36).substr(2, 9), name: '', smallErrors: 0, mediumErrors: 0, graveErrors: 0, omitted: false }]);
  };
  const updateKata = (id: string, field: keyof KataTechnique, value: any) => {
    setKataList(prev => prev.map(k => k.id === id ? { ...k, [field]: value, evaluated: true } : k));
  };
  const updateKataMultiple = (id: string, updates: Partial<KataTechnique>) => {
    setKataList(prev => prev.map(k => k.id === id ? { ...k, ...updates, evaluated: true } : k));
  };
  const removeKata = (id: string) => setKataList(kataList.filter(k => k.id !== id));

  // --- Lógica do Relatório ---
  const reportData = useMemo(() => {
    let totalPoints = 0;
    let totalPossiblePoints = 0;
    const pedagogicalObs: string[] = [];
    
    if (selectedTema !== 'Katas') {
      wazaList.forEach(w => {
        if (w.kuzushi !== 'AVALIAR' && w.tsukuri !== 'AVALIAR' && w.kake !== 'AVALIAR') {
          if (isHighDan) {
            // Alta Graduação (3 fases: Inovação, Eficiência, Aplicabilidade)
            totalPossiblePoints += 300; // 100 por fase
            
            const getHighDanPoints = (status: string) => {
              if (status === 'Ótimo') return 100;
              if (status === 'Bom') return 70;
              if (status === 'Regular') return 50;
              return 0;
            };

            totalPoints += getHighDanPoints(w.kuzushi); // Inovação
            totalPoints += getHighDanPoints(w.tsukuri); // Eficiência
            totalPoints += getHighDanPoints(w.kake);    // Aplicabilidade

            if (w.kuzushi === 'Regular' || w.kake === 'Regular') {
              pedagogicalObs.push(`Em ${w.name || 'Técnica não nomeada'}: Melhorar inovação e criatividade.`);
            }
            if (w.tsukuri === 'Regular') {
              pedagogicalObs.push(`Em ${w.name || 'Técnica não nomeada'}: Eficiência precisa ser aprimorada.`);
            }
          } else {
            // 1º a 3º Dan (3 fases: Kuzushi, Tsukuri, Kake)
            totalPossiblePoints += 300; // 100 por fase
            
            const getNormalPoints = (status: string) => {
              if (status === 'Realizada') return 100;
              if (status === 'Parcialmente Realizada') return 50;
              if (status === 'Não Realizada') return 0;
              return 0;
            };

            totalPoints += getNormalPoints(w.kuzushi);
            totalPoints += getNormalPoints(w.tsukuri);
            totalPoints += getNormalPoints(w.kake);

            if (w.kuzushi === 'Parcialmente Realizada' || w.tsukuri === 'Parcialmente Realizada') {
              pedagogicalObs.push(`Em ${w.name || 'Técnica não nomeada'}: Atenção aos detalhes de preparação (Kuzushi/Tsukuri).`);
            }
            if (w.kuzushi === 'Não Realizada' || w.tsukuri === 'Não Realizada') {
              pedagogicalObs.push(`Em ${w.name || 'Técnica não nomeada'}: Falha crítica na preparação (Kuzushi/Tsukuri).`);
            }
          }
        }
      });
    }

    if (selectedTema !== 'Katas' && !isHighDan) {
      kihonList.forEach(k => {
        if (k.status !== 'AVALIAR') {
          totalPossiblePoints += 100; // 100 por Kihon
          
          if (k.status === 'Realizada') totalPoints += 100;
          if (k.status === 'Parcialmente Realizada') {
            totalPoints += 50;
            pedagogicalObs.push(`Em ${k.name}: Atenção aos detalhes.`);
          }
          if (k.status === 'Não Realizada') {
            totalPoints += 0;
            pedagogicalObs.push(`Em ${k.name}: Falha crítica.`);
          }
        }
      });
    }

    const wazaPercentage = totalPossiblePoints > 0 ? Math.round((totalPoints / totalPossiblePoints) * 100) : null;

    let totalKataScore = 0;
    let evaluatedKataCount = 0;
    let hasOmitted = false;
    const kataErrorsList: string[] = [];

    if (selectedTema === 'Katas') {
      kataList.forEach(k => {
        if (k.evaluated) {
          evaluatedKataCount++;
          if (k.omitted) {
            hasOmitted = true;
            kataErrorsList.push(`${k.name || 'Técnica'}: Omitida (Nota 0).`);
            return;
          }
          const deductions = (k.smallErrors * 1) + (k.mediumErrors * 3) + (k.graveErrors * 5);
          let score = 10 - deductions;
          if (k.graveErrors === 0 && score < 5) score = 5;
          if (score < 0) score = 0;
          totalKataScore += score;
          if (deductions > 0) {
            kataErrorsList.push(`${k.name || 'Técnica'}: ${k.smallErrors} Peq, ${k.mediumErrors} Méd, ${k.graveErrors} Grav. Nota: ${score}/10`);
          }
        }
      });

      if (hasOmitted) {
        totalKataScore = totalKataScore / 2;
        kataErrorsList.push('PENALIDADE: Técnica omitida. Pontuação final do Kata dividida por 2.');
      }
    }

    const maxKataScore = evaluatedKataCount * 10;
    const kataPercentage = evaluatedKataCount > 0 ? Math.round((totalKataScore / maxKataScore) * 100) : null;

    let verdict = 'Aprovado';
    let pendingReasons = [];

    if (selectedTema !== 'Katas') {
      if (wazaPercentage === null) {
        verdict = 'Não Avaliado';
      } else if (wazaPercentage < 50) {
        verdict = 'Reprovado';
      } else if (wazaPercentage < 70) {
        verdict = 'Pendente';
        pendingReasons.push('Aproveitamento técnico (Waza) abaixo do ideal (70%).');
      }
    } else {
      if (kataPercentage === null) {
        verdict = 'Não Avaliado';
      } else if (hasOmitted || kataPercentage < 50) {
        verdict = 'Reprovado';
      } else if (kataPercentage < 70) {
        verdict = 'Pendente';
        pendingReasons.push('Desempenho no Kata abaixo do ideal (70%).');
      }
    }

    let studySuggestion = '';
    switch (finalTargetDan) {
      case 'Shodan (1º Dan)': studySuggestion = 'Focar na consolidação das técnicas fundamentais do Go-Kyu. '; break;
      case 'Nidan (2º Dan)': studySuggestion = 'Aprofundar o repertório com as técnicas do Extra Go-Kyu, mantendo a fluidez. '; break;
      case 'Sandan (3º Dan)': studySuggestion = 'Trabalhar a aplicabilidade das técnicas em cenários reais de combate esportivo (Shiai). '; break;
      case 'Yondan (4º Dan)': studySuggestion = 'Aprimorar os métodos educativos (Uchi-komi e Kakari-geiko). Demonstrar maior criatividade. '; break;
      case 'Godan (5º Dan)': studySuggestion = 'Focar na aplicabilidade das técnicas para Defesa Pessoal (Self-Defense), controle absoluto. '; break;
    }

    if (wazaPercentage !== null && wazaPercentage < 100) {
      if (isHighDan) {
        studySuggestion += 'Revisar os princípios de inovação, eficiência e criatividade nas técnicas. ';
      } else {
        studySuggestion += 'Revisar os princípios de Kuzushi e Tsukuri para garantir um Kake limpo. ';
      }
    }
    if (kataPercentage !== null && kataPercentage < 80 && kataList.length > 0) studySuggestion += 'Revisar os protocolos da IJF para os Katas, minimizando erros posturais.';

    return {
      wazaPercentage, totalPoints, totalPossiblePoints, pedagogicalObs, totalKataScore, maxKataScore,
      kataPercentage, kataErrorsList, verdict, pendingReasons, studySuggestion
    };
  }, [wazaList, kihonList, kataList, finalTargetDan, highDanEval]);

  useEffect(() => {
    if (!selectedModuloId) return;

    let channelName = '';
    if (isCoordinator && loggedUser) {
      channelName = `modulo_${selectedModuloId}_coord_${loggedUser.id}`;
    } else if (followingCoordinatorId) {
      channelName = `modulo_${selectedModuloId}_coord_${followingCoordinatorId}`;
    } else {
      return; // Wait until a coordinator is selected to join a channel
    }

    const channel = supabase.channel(channelName, {
      config: { 
        broadcast: { self: false },
        presence: { key: loggedUser?.id || 'anonymous' }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const activeIds = Object.keys(state);
      setActiveEvaluators(activeIds);
    });

    channel.on('broadcast', { event: 'sync_draw' }, ({ payload }) => {
      if (!isCoordinator) {
        setSelectedCandidatoId(payload.candidatoId);
        setManualCandidateName(payload.manualCandidateName);
        setTargetDan(payload.targetDan);
        setSelectedTema(payload.selectedTema || '');
        setShowReport(false);
        setPendingAutoSave(false);

        setWazaList(payload.wazaList.map((pw: any) => {
          // We don't have access to prev here easily without a ref, but in a sync scenario, 
          // we usually want to reset to AVALIAR anyway if it's a new draw.
          // If we need to preserve, we can use the current wazaList state, but since this
          // is a direct broadcast of a new draw, resetting is usually correct.
          // To be safe and preserve if possible, we use the current wazaList state.
          const existing = wazaList.find((w: any) => w.name === pw.name);
          return {
            id: pw.id,
            name: pw.name,
            kuzushi: existing ? existing.kuzushi : 'AVALIAR',
            tsukuri: existing ? existing.tsukuri : 'AVALIAR',
            kake: existing ? existing.kake : 'AVALIAR'
          };
        }));

        setKihonList(payload.kihonList.map((pk: any) => {
          const existing = kihonList.find((k: any) => k.name === pk.name);
          return {
            id: pk.id,
            name: pk.name,
            status: existing ? existing.status : 'AVALIAR'
          };
        }));

        setKataList(payload.kataList.map((pk: any) => {
          const existing = kataList.find((k: any) => k.name === pk.name);
          return {
            id: pk.id,
            name: pk.name,
            smallErrors: existing ? existing.smallErrors : 0,
            mediumErrors: existing ? existing.mediumErrors : 0,
            graveErrors: existing ? existing.graveErrors : 0,
            omitted: pk.omitted || false
          };
        }));
        
        setReleasedWazaIndex(-1);
        setReleasedKataIndex(-1);
        setReleasedKihonIndex(-1);
        setEvaluatorsFinishedWaza({});
        setEvaluatorsFinishedKata({});
        setEvaluatorsFinishedKihon({});

        if (payload.selectedTema === 'Katas' && payload.kataList && payload.kataList.length > 0) {
          setMainTab('avaliacao');
          setCurrentView('avaliacao');
          setFullscreenKataIndex(0);
        } else if (payload.selectedTema !== 'Katas' && payload.wazaList && payload.wazaList.length > 0) {
          setMainTab('avaliacao');
          setCurrentView('avaliacao');
          // Important: We set the index to 0 so the fullscreen mode opens immediately
          setFullscreenWazaIndex(0);
          setFullscreenActiveTab('kuzushi');
        } else if (payload.selectedTema !== 'Katas' && payload.kihonList && payload.kihonList.length > 0) {
          setMainTab('avaliacao');
          setCurrentView('avaliacao');
          setFullscreenKihonIndex(0);
        } else {
          setFullscreenWazaIndex(null);
          setFullscreenKataIndex(null);
          setFullscreenKihonIndex(null);
        }
        
        showToast('Sorteio sincronizado pelo Coordenador!', 'success');
      }
    }).on('broadcast', { event: 'release_waza' }, ({ payload }) => {
      if (!isCoordinator) {
        setReleasedWazaIndex(payload.index);
        setFullscreenWazaIndex(payload.index);
      }
    }).on('broadcast', { event: 'waza_evaluated' }, ({ payload }) => {
      if (isCoordinator) {
        setEvaluatorsFinishedWaza(prev => ({
          ...prev,
          [payload.avaliadorId]: Math.max(prev[payload.avaliadorId] || 0, payload.index)
        }));
      }
    }).on('broadcast', { event: 'release_kihon' }, ({ payload }) => {
      setReleasedKihonIndex(payload.index);
    }).on('broadcast', { event: 'kihon_evaluated' }, ({ payload }) => {
      if (isCoordinator) {
        setEvaluatorsFinishedKihon(prev => ({
          ...prev,
          [payload.avaliadorId]: Math.max(prev[payload.avaliadorId] || 0, payload.index)
        }));
      }
    }).on('broadcast', { event: 'release_kata' }, ({ payload }) => {
      setReleasedKataIndex(payload.index);
    }).on('broadcast', { event: 'kata_evaluated' }, ({ payload }) => {
      if (isCoordinator) {
        setEvaluatorsFinishedKata(prev => ({
          ...prev,
          [payload.avaliadorId]: Math.max(prev[payload.avaliadorId] || 0, payload.index)
        }));
      }
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: loggedUser?.id,
          role: isCoordinator ? 'coordinator' : 'evaluator'
        });
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [selectedModuloId, isCoordinator, followingCoordinatorId, loggedUser, showToast]);

  const broadcastDraw = () => {
    if (!channelRef.current) return;

    if (selectedTema === 'Katas' && kataList.length === 0) {
      showToast('Selecione um Kata antes de transmitir.', 'error');
      return;
    }

    if (selectedTema !== 'Katas' && wazaList.length === 0 && (!kihonList || kihonList.length === 0)) {
      showToast('Sorteie as técnicas antes de transmitir.', 'error');
      return;
    }

    const payload = {
      candidatoId: selectedCandidatoId,
      manualCandidateName,
      targetDan,
      selectedTema,
      wazaList: wazaList.map(w => ({ id: w.id, name: w.name })),
      kihonList: kihonList.map(k => ({ id: k.id, name: k.name })),
      kataList: kataList.map(k => ({ id: k.id, name: k.name, omitted: k.omitted }))
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'sync_draw',
      payload
    }).then((resp) => {
      if (resp !== 'ok') {
        showToast('Erro ao transmitir sorteio. Tente novamente.', 'error');
      } else {
        showToast('Sorteio transmitido para a banca!', 'success');
      }
    });

    setReleasedWazaIndex(-1);
    setReleasedKataIndex(-1);
    setReleasedKihonIndex(-1);
    setEvaluatorsFinishedWaza({});
    setEvaluatorsFinishedKata({});
    setEvaluatorsFinishedKihon({});

    if (selectedTema === 'Katas' && kataList.length > 0) {
      setMainTab('avaliacao');
      setCurrentView('avaliacao');
      setFullscreenKataIndex(0);
    } else if (selectedTema !== 'Katas' && wazaList.length > 0) {
      setMainTab('avaliacao');
      setCurrentView('avaliacao');
      setFullscreenWazaIndex(0);
      setFullscreenActiveTab('kuzushi');
    } else if (selectedTema !== 'Katas' && kihonList.length > 0) {
      setMainTab('avaliacao');
      setCurrentView('avaliacao');
      setFullscreenKihonIndex(0);
    }
  };

  const handleSave = useCallback(async () => {
    if (!reportData) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const { supabase } = await import('./lib/supabase');
      if (!import.meta.env.VITE_SUPABASE_URL) throw new Error('Credenciais do Supabase não configuradas.');

      // 1. Salvar a avaliação principal
      const { data: avaliacaoData, error: avaliacaoError } = await supabase.from('avaliacoes').insert([{
        candidato_id: (selectedCandidatoId && selectedCandidatoId !== 'manual') ? selectedCandidatoId : null,
        candidato_nome: finalCandidateName,
        avaliador_id: selectedAvaliadorId || null,
        avaliador_nome: activeAvaliador ? activeAvaliador.nome : 'Não informado',
        grau_pretendido: finalTargetDan,
        veredito: reportData.verdict,
        percentual_waza: reportData.wazaPercentage,
        nota_kata: reportData.kataPercentage,
        sugestao_estudo: reportData.studySuggestion,
        motivos_pendencia: reportData.pendingReasons,
        observacoes_pedagogicas: reportData.pedagogicalObs,
        erros_kata: reportData.kataErrorsList,
        modulo_id: selectedModuloId || null
      }]).select().single();

      if (avaliacaoError) throw avaliacaoError;
      const avaliacaoId = avaliacaoData.id;

      // 2. Salvar os dados de Waza (Técnicas)
      if (selectedTema !== 'Katas' && wazaList.length > 0) {
        const wazaInserts = wazaList.map(w => ({
          avaliacao_id: avaliacaoId,
          tecnica_nome: w.name,
          kuzushi: w.kuzushi,
          tsukuri: w.tsukuri,
          kake: w.kake
        }));
        const { error: wazaError } = await supabase.from('avaliacao_waza').insert(wazaInserts);
        if (wazaError) throw wazaError;
      }

      // 2.5 Salvar os dados de Kihon
      if (selectedTema !== 'Katas' && !isHighDan && kihonList.length > 0) {
        const kihonInserts = kihonList.map(k => ({
          avaliacao_id: avaliacaoId,
          kihon_nome: k.name,
          status: k.status
        }));
        const { error: kihonError } = await supabase.from('avaliacao_kihon').insert(kihonInserts);
        if (kihonError) throw kihonError;
      }

      // 3. Salvar os dados de Kata
      if (selectedTema === 'Katas' && kataList.length > 0) {
        const kataInserts = kataList.map(k => ({
          avaliacao_id: avaliacaoId,
          kata_nome: k.name,
          omitted: k.omitted,
          small_errors: k.smallErrors,
          medium_errors: k.mediumErrors,
          grave_errors: k.graveErrors
        }));
        const { error: kataError } = await supabase.from('avaliacao_kata').insert(kataInserts);
        if (kataError) throw kataError;
      }

      // 4. Salvar os dados de Alta Graduação (se aplicável)
      if (isHighDan && highDanEval) {
        const { error: highDanError } = await supabase.from('avaliacao_alta_graduacao').insert([{
          avaliacao_id: avaliacaoId,
          criatividade: highDanEval.creativity,
          inovacao: highDanEval.innovation,
          eficiencia: highDanEval.efficiency
        }]);
        if (highDanError) throw highDanError;
      }

      setSaveSuccess(true);
      
      // Clear local cache for this evaluation
      if (selectedModuloId && selectedCandidatoId && loggedUser) {
        const cacheKey = `eval_cache_${selectedModuloId}_${selectedCandidatoId}_${loggedUser.id}`;
        localStorage.removeItem(cacheKey);
      }

      if (selectedCandidatoId && selectedCandidatoId !== 'manual') {
        setEvaluatedCandidatesIds(prev => [...prev, selectedCandidatoId]);
      }
      setTimeout(() => {
        setSaveSuccess(false);
        setSelectedCandidatoId('');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      showToast(`Erro ao salvar no Supabase: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    reportData, selectedCandidatoId, finalCandidateName, selectedAvaliadorId, activeAvaliador, 
    finalTargetDan, selectedModuloId, selectedTema, wazaList, kihonList, kataList, isHighDan, highDanEval, 
    showToast, loggedUser
  ]);

  useEffect(() => {
    if (pendingAutoSave && reportData && !isSaving) {
      setPendingAutoSave(false);
      handleSave();
    }
  }, [pendingAutoSave, reportData, isSaving, handleSave]);

  if (placarModuloId) {
    return <PlacarResultados moduloId={placarModuloId} />;
  }

  if (treinamentoAccessId) {
    return <TreinamentoParticipantFlow treinamentoId={treinamentoAccessId} />;
  }

  if (!loggedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="flex justify-center items-center w-full mb-0 pointer-events-none">
              <img src="/judo_tech_icon.png" alt="Sensei Assistente Digital Logo" className="w-[200px] h-[200px] object-contain ml-[20px]" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 text-center tracking-tight leading-tight relative z-10">
              Sensei Assistente<br/>
              <span className="text-red-700 font-normal">Digital</span>
            </h1>
            <p className="text-slate-500 text-center mt-2">A evolução natural do seu dojo</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Login (Zempo)</label>
              <input
                type="text"
                value={loginZempo}
                onChange={(e) => setLoginZempo(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Digite seu Zempo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                value={senhaZempo}
                onChange={(e) => setSenhaZempo(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Primeiro acesso: repita o Zempo"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-red-700 hover:bg-red-800 text-white p-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-5 h-5" /> Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loggedUser && requirePasswordChange) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="flex justify-center items-center w-full mb-0 pointer-events-none">
              <img src="/judo_tech_icon.png" alt="Sensei Assistente Digital Logo" className="w-[200px] h-[200px] object-contain ml-[20px]" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 text-center relative z-10">Primeiro Acesso</h1>
            <p className="text-slate-500 text-center mt-2">Por segurança, crie uma nova senha para sua conta.</p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Repita a nova senha"
                required
              />
            </div>

            {passwordChangeError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {passwordChangeError}
              </div>
            )}

            <button
              type="submit"
              disabled={isChangingPassword}
              className="w-full bg-red-700 hover:bg-red-800 text-white p-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChangingPassword ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                'Salvar e Continuar'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-red-700 text-white p-6 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/judo_tech_icon.png" alt="Logo" className="w-[100px] h-[100px] object-contain brightness-0 invert -mr-[15px]" />
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Sensei Assistente <span className="text-red-200 font-normal">Digital</span>
              </h1>
              <p className="text-red-100 text-sm">A evolução natural do seu dojo</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Main Navigation Tabs */}
            <div className="flex flex-wrap justify-center bg-red-800 rounded-lg p-1">
              {loggedRole === 'avaliador' && (
                <button 
                  onClick={() => { setMainTab('avaliacao'); setCurrentView('avaliacao'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'avaliacao' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
                >
                  <ClipboardSignature className="w-4 h-4" /> Avaliação
                </button>
              )}
              {isUserAdmin(loggedUser) && (
                <button 
                  onClick={() => { setMainTab('configuracao'); if (currentView === 'avaliacao') setCurrentView('candidatos'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'configuracao' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
                >
                  <Settings className="w-4 h-4" /> Configuração
                </button>
              )}
              <button 
                onClick={() => { setMainTab('resultados'); setCurrentView('resultados'); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'resultados' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
              >
                <FileText className="w-4 h-4" /> Resultados
              </button>
              {loggedRole === 'candidato' && (
                <button 
                  onClick={() => { setMainTab('realizar_prova'); setCurrentView('realizar_prova'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'realizar_prova' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
                >
                  <CheckSquare className="w-4 h-4" /> Minhas Provas
                </button>
              )}
              {isUserAdmin(loggedUser) && (
                <button 
                  onClick={() => { setMainTab('treinamento'); setCurrentView('treinamento'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${mainTab === 'treinamento' ? 'bg-white text-red-700 shadow-sm' : 'text-red-100 hover:bg-red-700'}`}
                >
                  <GraduationCap className="w-4 h-4" /> Treinamento
                </button>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-100 hover:text-white text-sm font-medium"
              title="Sair"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-8 px-4">
        
        {/* Sub-Navigation for Configuração */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && (
          <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <button 
              onClick={() => setCurrentView('candidatos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'candidatos' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <Users className="w-4 h-4" /> Candidatos
            </button>
            <button 
              onClick={() => setCurrentView('avaliadores')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'avaliadores' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <UserCheck className="w-4 h-4" /> Avaliadores
            </button>
            <button 
              onClick={() => setCurrentView('tecnicas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'tecnicas' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <Layers className="w-4 h-4" /> Técnicas
            </button>
            <button 
              onClick={() => setCurrentView('katas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'katas' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <BookOpen className="w-4 h-4" /> Katas
            </button>
            <button 
              onClick={() => setCurrentView('avaliacoes_teoricas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'avaliacoes_teoricas' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <FileText className="w-4 h-4" /> Notas Teóricas
            </button>
            <button 
              onClick={() => setCurrentView('banco_questoes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'banco_questoes' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <HelpCircle className="w-4 h-4" /> Banco de Questões
            </button>
            <button 
              onClick={() => setCurrentView('provas_teoricas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'provas_teoricas' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              <CheckSquare className="w-4 h-4" /> Provas Teóricas
            </button>
          </div>
        )}

        {/* VIEW: CADASTRO DE CANDIDATOS */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'candidatos' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-red-600" /> Cadastro de Candidatos
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => downloadCSVTemplate('candidatos')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Baixar modelo de CSV"
                >
                  <Download className="w-4 h-4" /> Modelo CSV
                </button>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputCandidatosRef}
                  onChange={handleImportCandidatos}
                />
                <button 
                  onClick={() => fileInputCandidatosRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" /> Importar CSV
                </button>
                <button 
                  onClick={addManualCandidato}
                  className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors border border-red-200"
                >
                  <Plus className="w-4 h-4" /> Adicionar Manual
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-6 text-sm text-blue-800">
              <strong>Formato esperado do CSV:</strong> <code>nome, grau_pretendido, dojo, zempo</code> (A primeira linha deve ser o cabeçalho).
            </div>

            {candidatos.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum candidato cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-sm font-semibold text-slate-600">Nome</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Grau Pretendido</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Dojo / Clube</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Zempo (RNJ)</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatos.map((c, i) => (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2">
                          <input type="text" value={c.nome} onChange={(e) => {
                            const newC = [...candidatos]; newC[i].nome = e.target.value; setCandidatos(newC);
                          }} onBlur={(e) => updateCandidatoDB(c.id, 'nome', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Nome do Candidato" />
                        </td>
                        <td className="p-2">
                          <select value={c.grau_pretendido} onChange={(e) => {
                            const newC = [...candidatos]; newC[i].grau_pretendido = e.target.value as Dan; setCandidatos(newC);
                            updateCandidatoDB(c.id, 'grau_pretendido', e.target.value);
                          }} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white">
                            <option value="Shodan (1º Dan)">Shodan (1º Dan)</option>
                            <option value="Nidan (2º Dan)">Nidan (2º Dan)</option>
                            <option value="Sandan (3º Dan)">Sandan (3º Dan)</option>
                            <option value="Yondan (4º Dan)">Yondan (4º Dan)</option>
                            <option value="Godan (5º Dan)">Godan (5º Dan)</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="text" value={c.dojo} onChange={(e) => {
                            const newC = [...candidatos]; newC[i].dojo = e.target.value; setCandidatos(newC);
                          }} onBlur={(e) => updateCandidatoDB(c.id, 'dojo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Dojo/Clube" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={c.zempo || ''} onChange={(e) => {
                            const newC = [...candidatos]; newC[i].zempo = e.target.value; setCandidatos(newC);
                          }} onBlur={(e) => updateCandidatoDB(c.id, 'zempo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Nº Zempo" />
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => deleteCandidato(c.id)} className="text-slate-400 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW: CADASTRO DE AVALIADORES */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'avaliadores' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-red-600" /> Cadastro de Avaliadores
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => downloadCSVTemplate('avaliadores')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Baixar modelo de CSV"
                >
                  <Download className="w-4 h-4" /> Modelo CSV
                </button>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputAvaliadoresRef}
                  onChange={handleImportAvaliadores}
                />
                <button 
                  onClick={() => fileInputAvaliadoresRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" /> Importar CSV
                </button>
                <button 
                  onClick={handleImportFromTreinamento}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors border border-blue-200"
                  title="Importar participantes da tabela de treinamentos"
                >
                  <Users className="w-4 h-4" /> Importar do Treinamento
                </button>
                <button 
                  onClick={addManualAvaliador}
                  className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors border border-red-200"
                >
                  <Plus className="w-4 h-4" /> Adicionar Manual
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-6 text-sm text-blue-800">
              <strong>Formato esperado do CSV:</strong> <code>nome, graduacao, zempo, funcao</code> (A primeira linha deve ser o cabeçalho).
            </div>

            {avaliadores.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum avaliador cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-sm font-semibold text-slate-600">Nome do Avaliador</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Graduação</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Zempo</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Função</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avaliadores.map((a, i) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2">
                          <input type="text" value={a.nome} onChange={(e) => {
                            const newA = [...avaliadores]; newA[i].nome = e.target.value; setAvaliadores(newA);
                          }} onBlur={(e) => updateAvaliadorDB(a.id, 'nome', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Nome do Avaliador" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={a.graduacao} onChange={(e) => {
                            const newA = [...avaliadores]; newA[i].graduacao = e.target.value; setAvaliadores(newA);
                          }} onBlur={(e) => updateAvaliadorDB(a.id, 'graduacao', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: 6º Dan" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={a.zempo || ''} onChange={(e) => {
                            const newA = [...avaliadores]; newA[i].zempo = e.target.value; setAvaliadores(newA);
                          }} onBlur={(e) => updateAvaliadorDB(a.id, 'zempo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Zempo" />
                        </td>
                        <td className="p-2">
                          <select value={a.funcao || 'avaliador'} onChange={(e) => {
                            const newA = [...avaliadores]; newA[i].funcao = e.target.value; setAvaliadores(newA);
                            updateAvaliadorDB(a.id, 'funcao', e.target.value);
                          }} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white">
                            <option value="avaliador">Avaliador</option>
                            <option value="coordenador">Coordenador</option>
                            <option value="gestor">Gestor</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => deleteAvaliador(a.id)} className="text-slate-400 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW: CADASTRO DE TÉCNICAS */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'tecnicas' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="w-6 h-6 text-red-600" /> Cadastro de Técnicas
              </h2>
              <div className="flex gap-2">
                {isUserAdmin(loggedUser) && selectedTecnicas.size > 0 && (
                  <button 
                    onClick={() => handleDeleteTecnicas(Array.from(selectedTecnicas))}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Selecionados ({selectedTecnicas.size})
                  </button>
                )}
                <button 
                  onClick={() => downloadCSVTemplate('tecnicas')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Baixar modelo de CSV"
                >
                  <Download className="w-4 h-4" /> Modelo CSV
                </button>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputTecnicasRef}
                  onChange={handleImportTecnicas}
                />
                <button 
                  onClick={() => fileInputTecnicasRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" /> Importar CSV
                </button>
                <button 
                  onClick={addManualTecnica}
                  className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors border border-red-200"
                >
                  <Plus className="w-4 h-4" /> Adicionar Manual
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-6 text-sm text-blue-800">
              <strong>Formato esperado do CSV:</strong> <code>nome, grupo, tipo</code> (A primeira linha deve ser o cabeçalho). Ex: <em>Ippon Seoi Nage, Te-waza, Nage-waza</em>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Pesquisar por Nome</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Ex: Uchi Mata" 
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                    value={filtroTecnicaNome}
                    onChange={e => setFiltroTecnicaNome(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Grupo</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none bg-white"
                  value={filtroTecnicaGrupo}
                  onChange={e => setFiltroTecnicaGrupo(e.target.value)}
                >
                  <option value="">Todos os Grupos</option>
                  {Array.from(new Set(tecnicas.map(t => t.grupo).filter(Boolean))).sort().map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>
            </div>

            {tecnicas.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhuma técnica cadastrada.</p>
            ) : (() => {
              const filteredTecnicas = tecnicas.filter(t => {
                if (filtroTecnicaNome && !t.nome.toLowerCase().includes(filtroTecnicaNome.toLowerCase())) return false;
                if (filtroTecnicaGrupo && t.grupo !== filtroTecnicaGrupo) return false;
                return true;
              });

              return filteredTecnicas.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nenhuma técnica encontrada com os filtros atuais.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {isUserAdmin(loggedUser) && (
                          <th className="p-3 w-12 text-center">
                            <input 
                              type="checkbox" 
                              className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                              checked={selectedTecnicas.size === filteredTecnicas.length && filteredTecnicas.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTecnicas(new Set(filteredTecnicas.map(t => t.id)));
                                } else {
                                  setSelectedTecnicas(new Set());
                                }
                              }}
                            />
                          </th>
                        )}
                        <th className="p-3 text-sm font-semibold text-slate-600">Nome da Técnica</th>
                        <th className="p-3 text-sm font-semibold text-slate-600">Grupo (Koshi, Te, Ashi...)</th>
                        <th className="p-3 text-sm font-semibold text-slate-600">Tipo</th>
                        <th className="p-3 text-sm font-semibold text-slate-600 w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTecnicas.map((t, i) => {
                        const originalIndex = tecnicas.findIndex(orig => orig.id === t.id);
                        return (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                          {isUserAdmin(loggedUser) && (
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                checked={selectedTecnicas.has(t.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedTecnicas);
                                  if (e.target.checked) {
                                    newSelected.add(t.id);
                                  } else {
                                    newSelected.delete(t.id);
                                  }
                                  setSelectedTecnicas(newSelected);
                                }}
                              />
                            </td>
                          )}
                          <td className="p-2">
                            <input type="text" value={t.nome} onChange={(e) => {
                              const newT = [...tecnicas]; newT[originalIndex].nome = e.target.value; setTecnicas(newT);
                            }} onBlur={(e) => updateTecnicaDB(t.id, 'nome', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: Uchi Mata" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={t.grupo} onChange={(e) => {
                              const newT = [...tecnicas]; newT[originalIndex].grupo = e.target.value; setTecnicas(newT);
                            }} onBlur={(e) => updateTecnicaDB(t.id, 'grupo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: Ashi-waza" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={t.tipo || ''} onChange={(e) => {
                              const newT = [...tecnicas]; newT[originalIndex].tipo = e.target.value; setTecnicas(newT);
                            }} onBlur={(e) => updateTecnicaDB(t.id, 'tipo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: Nage-waza" />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => handleDeleteTecnicas([t.id])} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW: KATAS */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'katas' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-red-600" /> Cadastro de Katas
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => downloadCSVTemplate('katas')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                  title="Baixar modelo de CSV"
                >
                  <Download className="w-4 h-4" /> Modelo CSV
                </button>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputKatasRef}
                  onChange={handleImportKatas}
                />
                <button 
                  onClick={() => fileInputKatasRef.current?.click()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" /> Importar CSV
                </button>
                <button 
                  onClick={addManualKata}
                  className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors border border-red-200"
                >
                  <Plus className="w-4 h-4" /> Adicionar Manual
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-6 text-sm text-blue-800">
              <strong>Formato esperado do CSV:</strong> <code>Nome da Técnica;Ordem;Kata</code> (A primeira linha deve ser o cabeçalho). Ex: <em>Uki-otoshi;1;Nage-no-Kata (Te-waza)</em>
            </div>

            {katas.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Nenhum kata cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-sm font-semibold text-slate-600">Nome da Técnica</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Ordem</th>
                      <th className="p-3 text-sm font-semibold text-slate-600">Kata (Grupo)</th>
                      <th className="p-3 text-sm font-semibold text-slate-600 w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {katas.map((k, i) => (
                      <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="p-2">
                          <input type="text" value={k.nome} onChange={(e) => updateKataDB(k.id, 'nome', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: Uki-otoshi" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={k.ordem} onChange={(e) => updateKataDB(k.id, 'ordem', parseInt(e.target.value) || 0)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: 1" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={k.grupo} onChange={(e) => updateKataDB(k.id, 'grupo', e.target.value)} className="w-full p-1.5 border border-transparent hover:border-slate-300 focus:border-red-500 rounded outline-none bg-transparent focus:bg-white" placeholder="Ex: Nage-no-Kata" />
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => deleteKata(k.id)} className="text-slate-400 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW: AVALIAÇÕES TEÓRICAS */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'avaliacoes_teoricas' && (
          <AvaliacoesTeoricas />
        )}

        {/* VIEW: BANCO DE QUESTÕES */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'banco_questoes' && (
          <BancoQuestoes />
        )}

        {/* VIEW: PROVAS TEÓRICAS */}
        {isUserAdmin(loggedUser) && mainTab === 'configuracao' && currentView === 'provas_teoricas' && (
          <ProvasTeoricasAdmin />
        )}

        {/* VIEW: REALIZAR PROVA (CANDIDATO) */}
        {loggedRole === 'candidato' && mainTab === 'realizar_prova' && currentView === 'realizar_prova' && (
          <RealizarProva candidatoId={loggedUser.id} />
        )}

        {/* VIEW: AVALIAÇÃO */}
        {mainTab === 'avaliacao' && !selectedModuloId && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ClipboardSignature className="w-6 h-6 text-red-600" /> Módulos de Avaliação
              </h2>
              {(loggedRole === 'avaliador' && ('funcao' in loggedUser) && (isUserAdmin(loggedUser) || loggedUser.funcao === 'coordenador')) && (
                <button 
                  onClick={() => setIsCreatingModulo(true)} 
                  className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Novo Módulo
                </button>
              )}
            </div>

            {isCreatingModulo && (
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 animate-in slide-in-from-top-4">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">{editingModuloId ? 'Editar Módulo de Avaliação' : 'Criar Novo Módulo de Avaliação'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Módulo</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" placeholder="Ex: Exame de Faixa Preta 2026 - Turma A" value={newModulo.nome || ''} onChange={e => setNewModulo({...newModulo, nome: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                    <input type="date" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" value={newModulo.data || ''} onChange={e => setNewModulo({...newModulo, data: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horário Início</label>
                    <input type="time" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" value={newModulo.horario_inicio || ''} onChange={e => setNewModulo({...newModulo, horario_inicio: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horário Fim</label>
                    <input type="time" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" value={newModulo.horario_fim || ''} onChange={e => setNewModulo({...newModulo, horario_fim: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Região</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" placeholder="Ex: Sul" value={newModulo.regiao || ''} onChange={e => setNewModulo({...newModulo, regiao: e.target.value})} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Local</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" placeholder="Ex: Ginásio Municipal" value={newModulo.local || ''} onChange={e => setNewModulo({...newModulo, local: e.target.value})} />
                  </div>
                  <div className="lg:col-span-2 relative">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tema (Grupo)</label>
                    <div className="border border-slate-300 rounded-md p-2 bg-white max-h-40 overflow-y-auto">
                      {['Te Waza', 'Koshi Waza', 'Ashi waza', 'Sutemi Waza', 'Ossae Waza', 'Shime Waza', 'Kansetsu Waza', 'Kaeshi Waza', 'Renraku Henka Waza', 'Katas'].map(tema => (
                        <label key={tema} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={(newModulo.tema || '').split(', ').includes(tema)}
                            onChange={(e) => {
                              let currentTemas = (newModulo.tema || '').split(', ').filter(t => t);
                              if (e.target.checked) {
                                if (tema === 'Katas') {
                                  currentTemas = ['Katas'];
                                } else {
                                  currentTemas = currentTemas.filter(t => t !== 'Katas');
                                  currentTemas.push(tema);
                                }
                              } else {
                                currentTemas = currentTemas.filter(t => t !== tema);
                              }
                              setNewModulo({...newModulo, tema: currentTemas.join(', ')});
                            }}
                            className="rounded text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-slate-700">{tema}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. Técnicas</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none" 
                      value={newModulo.quantidade_tecnicas || 1} 
                      onChange={e => setNewModulo({...newModulo, quantidade_tecnicas: parseInt(e.target.value) || 1})} 
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Avaliadores do Módulo</label>
                    <div className="border border-slate-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {avaliadores.map(avaliador => (
                        <label key={avaliador.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                          <input 
                            type="checkbox" 
                            className="rounded text-red-600 focus:ring-red-500"
                            checked={newModulo.avaliadores_ids?.includes(avaliador.id) || false}
                            onChange={(e) => {
                              const currentIds = newModulo.avaliadores_ids || [];
                              if (e.target.checked) {
                                setNewModulo({...newModulo, avaliadores_ids: [...currentIds, avaliador.id]});
                              } else {
                                setNewModulo({
                                  ...newModulo, 
                                  avaliadores_ids: currentIds.filter(id => id !== avaliador.id),
                                  coordenadores_ids: (newModulo.coordenadores_ids || []).filter(id => id !== avaliador.id)
                                });
                              }
                            }}
                          />
                          <span className="text-sm text-slate-700 truncate">{avaliador.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coordenadores do Módulo</label>
                    <div className="border border-slate-300 rounded-md p-3 max-h-48 overflow-y-auto bg-white grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {avaliadores.filter(a => newModulo.avaliadores_ids?.includes(a.id)).length > 0 ? (
                        avaliadores.filter(a => newModulo.avaliadores_ids?.includes(a.id)).map(avaliador => (
                          <label key={avaliador.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input 
                              type="checkbox" 
                              className="rounded text-red-600 focus:ring-red-500"
                              checked={newModulo.coordenadores_ids?.includes(avaliador.id) || false}
                              onChange={(e) => {
                                const currentIds = newModulo.coordenadores_ids || [];
                                if (e.target.checked) {
                                  setNewModulo({...newModulo, coordenadores_ids: [...currentIds, avaliador.id]});
                                } else {
                                  setNewModulo({...newModulo, coordenadores_ids: currentIds.filter(id => id !== avaliador.id)});
                                }
                              }}
                            />
                            <span className="text-sm text-slate-700 truncate">{avaliador.nome}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 col-span-full">Selecione primeiro os avaliadores do módulo acima.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setIsCreatingModulo(false); setEditingModuloId(null); setNewModulo({ avaliadores_ids: [], coordenadores_ids: [] }); }} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md font-medium transition-colors">Cancelar</button>
                  <button onClick={handleSaveModulo} className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 font-medium transition-colors">Salvar Módulo</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modulos.filter(m => {
                if (loggedRole !== 'avaliador') return true;
                if (isUserAdmin(loggedUser)) return true;
                return m.avaliadores_ids?.includes(loggedUser?.id || '') || m.coordenadores_ids?.includes(loggedUser?.id || '');
              }).sort((a, b) => {
                const dateA = a.data ? new Date(a.data).getTime() : 0;
                const dateB = b.data ? new Date(b.data).getTime() : 0;
                return dateA - dateB;
              }).map(m => (
                <div key={m.id} className="border border-slate-200 rounded-xl p-5 hover:border-red-300 hover:shadow-md transition-all bg-white flex flex-col h-full relative group">
                  {(loggedRole === 'avaliador' && ('funcao' in loggedUser) && (isUserAdmin(loggedUser) || m.coordenadores_ids?.includes(loggedUser.id))) && (
                    <button 
                      onClick={() => {
                        setEditingModuloId(m.id);
                        setNewModulo(m);
                        setIsCreatingModulo(true);
                      }}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar Módulo"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <div className="font-bold text-lg mb-1 text-slate-800 line-clamp-2 pr-8">{m.nome || m.tema || 'Sem Nome'}</div>
                  {m.nome && m.tema && <div className="text-xs font-medium text-red-600 mb-3 bg-red-50 inline-block px-2 py-1 rounded">{m.tema}</div>}
                  {!m.nome && <div className="mb-3"></div>}
                  <div className="text-sm text-slate-600 space-y-2 flex-grow">
                    <p className="flex items-center gap-2"><span className="font-medium w-16">Data:</span> {m.data ? m.data.split('-').reverse().join('/') : 'N/A'}</p>
                    <p className="flex items-center gap-2"><span className="font-medium w-16">Horário:</span> {m.horario_inicio || '--:--'} às {m.horario_fim || '--:--'}</p>
                    <p className="flex items-start gap-2"><span className="font-medium w-16">Local:</span> <span className="flex-1">{m.local || 'N/A'} {m.regiao ? `(${m.regiao})` : ''}</span></p>
                  </div>
                  <button 
                    onClick={() => setSelectedModuloId(m.id)} 
                    className="mt-6 w-full bg-red-50 text-red-700 py-2.5 rounded-md font-medium hover:bg-red-100 transition-colors"
                  >
                    Acessar Módulo
                  </button>
                </div>
              ))}
              {modulos.filter(m => {
                if (loggedRole !== 'avaliador') return true;
                if (isUserAdmin(loggedUser)) return true;
                return m.avaliadores_ids?.includes(loggedUser?.id || '') || m.coordenadores_ids?.includes(loggedUser?.id || '');
              }).length === 0 && !isCreatingModulo && (
                <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <ClipboardSignature className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-lg font-medium text-slate-600">Nenhum módulo de avaliação encontrado.</p>
                  <p className="text-sm mt-1">Crie um novo módulo para começar a avaliar os candidatos.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mainTab === 'avaliacao' && selectedModuloId && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Módulo: {modulos.find(m => m.id === selectedModuloId)?.tema}</h2>
                <p className="text-sm text-slate-500">
                  {modulos.find(m => m.id === selectedModuloId)?.local} • {modulos.find(m => m.id === selectedModuloId)?.data ? modulos.find(m => m.id === selectedModuloId)?.data?.split('-').reverse().join('/') : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isCoordinator && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?placar=${selectedModuloId}`;
                      navigator.clipboard.writeText(url);
                      showToast('Link do placar copiado!', 'success');
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    Copiar Link do Placar
                  </button>
                )}
                <button 
                  onClick={() => setSelectedModuloId('')} 
                  className="text-sm text-slate-600 hover:text-red-700 border border-slate-300 hover:border-red-300 px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Trocar Módulo
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${selectedCandidatoId ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-8`}>
              {/* Left Column: Input Forms */}
              <div className={`${selectedCandidatoId ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-6`}>
                <datalist id="tecnicas-list">
                  {tecnicas.map(t => (
                    <option key={t.id} value={t.nome}>{t.grupo}</option>
                  ))}
                </datalist>
                <datalist id="katas-list">
                  {katas.map(k => (
                    <option key={k.id} value={k.nome}>{k.grupo} (Ordem: {k.ordem})</option>
                  ))}
                </datalist>

              {/* Candidate Info */}
              <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2">
                  <User className="w-5 h-5 text-red-600" />
                  Dados da Avaliação
                </h2>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Avaliador Responsável</label>
                    <select 
                      value={selectedAvaliadorId}
                      disabled
                      className="w-full p-2 border border-slate-300 rounded-md outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                    >
                      <option value="">Selecione um avaliador...</option>
                      {[...avaliadores].sort((a, b) => a.nome.localeCompare(b.nome)).map(a => (
                        <option key={a.id} value={a.id}>{a.nome} ({a.graduacao})</option>
                      ))}
                    </select>
                    
                    {(loggedRole === 'avaliador' && ('funcao' in loggedUser) && (isUserAdmin(loggedUser) || modulos.find(m => m.id === selectedModuloId)?.coordenadores_ids?.includes(loggedUser.id))) && (
                      <div className="mt-2 flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="isCoordinator" 
                          checked={isCoordinator} 
                          onChange={(e) => setIsCoordinator(e.target.checked)}
                          className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                        />
                        <label htmlFor="isCoordinator" className="text-sm text-slate-600 font-medium">
                          Sou o Coordenador (Guiar a banca)
                        </label>
                      </div>
                    )}

                    {!isCoordinator && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Acompanhar Banca do Coordenador</label>
                        <select
                          value={followingCoordinatorId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFollowingCoordinatorId(val);
                            if (loggedUser && selectedModuloId) {
                              if (val) {
                                localStorage.setItem(`following_coord_${selectedModuloId}_${loggedUser.id}`, val);
                              } else {
                                localStorage.removeItem(`following_coord_${selectedModuloId}_${loggedUser.id}`);
                              }
                            }
                          }}
                          className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        >
                          <option value="">Selecione o coordenador da sua banca...</option>
                          {modulos.find(m => m.id === selectedModuloId)?.coordenadores_ids?.map(coordId => {
                            const coord = avaliadores.find(a => a.id === coordId);
                            return coord ? <option key={coord.id} value={coord.id}>{coord.nome}</option> : null;
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {!selectedCandidatoId ? (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    {isCoordinator ? (
                      <>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-red-500" />
                          Indicar novo Candidato
                        </h3>
                        <div className="w-full text-left">
                          {isAddingManualCandidate ? (
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                              <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">Novo Candidato</h3>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Nome Completo</label>
                                <input 
                                  type="text" 
                                  value={manualCandidateName}
                                  onChange={(e) => setManualCandidateName(e.target.value)}
                                  className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                  placeholder="Ex: Jigoro Kano"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Grau Pretendido</label>
                                <select 
                                  value={targetDan}
                                  onChange={(e) => setTargetDan(e.target.value as Dan)}
                                  className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                >
                                  <option value="Shodan (1º Dan)">Shodan (1º Dan)</option>
                                  <option value="Nidan (2º Dan)">Nidan (2º Dan)</option>
                                  <option value="Sandan (3º Dan)">Sandan (3º Dan)</option>
                                  <option value="Yondan (4º Dan)">Yondan (4º Dan)</option>
                                  <option value="Godan (5º Dan)">Godan (5º Dan)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Dojo</label>
                                <input 
                                  type="text" 
                                  value={manualDojo}
                                  onChange={(e) => setManualDojo(e.target.value)}
                                  className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                  placeholder="Ex: Kodokan"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Zempo</label>
                                <input 
                                  type="text" 
                                  value={manualZempo}
                                  onChange={(e) => setManualZempo(e.target.value)}
                                  className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                  placeholder="Ex: 12345"
                                />
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button 
                                  onClick={() => setIsAddingManualCandidate(false)}
                                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-md font-medium transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (!manualCandidateName.trim()) {
                                      showToast('Preencha o nome do candidato.', 'error');
                                      return;
                                    }
                                    try {
                                      const { data, error } = await supabase.from('candidatos').insert([{ 
                                        nome: manualCandidateName, 
                                        grau_pretendido: targetDan, 
                                        dojo: manualDojo, 
                                        zempo: manualZempo 
                                      }]).select();
                                      
                                      if (error) throw error;
                                      if (data && data.length > 0) {
                                        setCandidatos(prev => [...prev, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
                                        setSelectedCandidatoId(data[0].id);
                                        setIsAddingManualCandidate(false);
                                        showToast('Candidato adicionado com sucesso!', 'success');
                                      }
                                    } catch (err: any) {
                                      showToast(`Erro ao adicionar candidato: ${err.message}`, 'error');
                                    }
                                  }}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md font-medium transition-colors"
                                >
                                  Salvar e Iniciar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <select 
                                value={selectedCandidatoId}
                                onChange={(e) => {
                                  if (e.target.value === 'manual') {
                                    setIsAddingManualCandidate(true);
                                    setManualCandidateName('');
                                    setManualDojo('');
                                    setManualZempo('');
                                    setTargetDan('Shodan (1º Dan)');
                                  } else {
                                    setSelectedCandidatoId(e.target.value);
                                  }
                                }}
                                className="w-full p-3 border-2 border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white shadow-sm text-slate-700 text-lg transition-all"
                              >
                                <option value="">SELECIONE O CANDIDATO</option>
                                <option value="manual">+ Adicionar Novo Candidato (Entrada Manual)</option>
                                {[...candidatos].sort((a, b) => a.nome.localeCompare(b.nome)).map(c => {
                                  const isEvaluated = evaluatedCandidatesIds.includes(c.id);
                                  return (
                                    <option key={c.id} value={c.id} disabled={isEvaluated}>
                                      {c.nome} - {c.dojo} {isEvaluated ? '(Já avaliado)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </>
                          )}
                        </div>
                      </>
                    ) : !followingCoordinatorId ? (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                        <Users className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Selecione sua Banca</h3>
                        <p className="text-xs text-slate-500">
                          Por favor, selecione qual coordenador você está acompanhando acima para começar a receber o sorteio.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                        <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-pulse" />
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Aguardando próximo candidato</h3>
                        <p className="text-xs text-slate-500">
                          O coordenador da banca está selecionando o próximo candidato.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-md text-sm text-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>Avaliando <strong>{finalCandidateName}</strong> para <strong>{finalTargetDan}</strong>.</span>
                      </div>
                      {isCoordinator && (
                        <button
                          onClick={() => {
                            setSelectedCandidatoId('');
                            setManualCandidateName('');
                            setWazaList([]);
                            setKataList([]);
                            setKihonList([
                              { id: 'kihon-1', name: 'Rei (Saudação)', status: 'AVALIAR' },
                              { id: 'kihon-2', name: 'Kumi kata (Pegada)', status: 'AVALIAR' },
                              { id: 'kihon-3', name: 'Shintai (Deslocamento)', status: 'AVALIAR' }
                            ]);
                            setFullscreenWazaIndex(null);
                            setFullscreenKataIndex(null);
                            setFullscreenKihonIndex(null);
                            setReleasedWazaIndex(-1);
                            setReleasedKataIndex(-1);
                            setReleasedKihonIndex(-1);
                          }}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-md transition-colors shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Substituir Candidato
                        </button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Seleção de Kata */}
                {selectedTema === 'Katas' && isCoordinator && selectedCandidatoId && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">Gerar Avaliação de Kata</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-end w-full">
                      <div className="w-full md:flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider text-left">Selecione o Kata</label>
                        <select 
                          value={selectedKataGroup}
                          onChange={(e) => {
                            const group = e.target.value;
                            setSelectedKataGroup(group);
                            if (group) {
                              generateKataEvaluation(group, kataEvalMode);
                            } else {
                              setKataList([]);
                            }
                          }}
                          className="w-full p-2 border border-slate-300 rounded-md outline-none text-sm focus:ring-2 focus:ring-red-500 bg-white"
                        >
                          <option value="">Selecione um Kata...</option>
                          {Array.from<string>(new Set(katas.map(k => k.grupo.split('(')[0].trim()))).filter(Boolean).sort((a, b) => {
                            const order = ['nage-no-kata', 'katame-no-kata', 'ju-no-kata', 'kime-no-kata', 'kodokan-goshin-jutsu'];
                            const getIndex = (name: string) => {
                              const normalized = name.toLowerCase();
                              for (let i = 0; i < order.length; i++) {
                                if (normalized.includes(order[i])) return i;
                              }
                              return 999;
                            };
                            const indexA = getIndex(a);
                            const indexB = getIndex(b);
                            if (indexA !== indexB) return indexA - indexB;
                            return a.localeCompare(b);
                          }).map(grupo => (
                            <option key={grupo} value={grupo}>{grupo}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full md:w-48">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider text-left">Modo de Avaliação</label>
                        <select 
                          value={kataEvalMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'completo' | 'serie';
                            setKataEvalMode(mode);
                            if (selectedKataGroup) {
                              generateKataEvaluation(selectedKataGroup, mode);
                            }
                          }}
                          className="w-full p-2 border border-slate-300 rounded-md outline-none text-sm focus:ring-2 focus:ring-red-500 bg-white"
                        >
                          <option value="completo">Completo</option>
                          <option value="serie">Uma Série (Sorteio)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sorteio de Técnicas (Waza) - Oculto conforme solicitado */}
                {false && selectedTema !== 'Katas' && isCoordinator && selectedCandidatoId && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">Sorteio de Técnicas</h3>
                      <button 
                        onClick={addWaza}
                        className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Manualmente
                      </button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Tema / Grupo</label>
                        <select 
                          value={selectedTema}
                          disabled
                          className="w-full p-2 border border-slate-300 rounded-md outline-none bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
                        >
                          <option value="">Selecione um tema...</option>
                          <option value="Te Waza">Te Waza</option>
                          <option value="Koshi Waza">Koshi Waza</option>
                          <option value="Ashi waza">Ashi waza</option>
                          <option value="Sutemi Waza">Sutemi Waza</option>
                          <option value="Ossae Waza">Ossae Waza</option>
                          <option value="Shime Waza">Shime Waza</option>
                          <option value="Kansetsu Waza">Kansetsu Waza</option>
                          <option value="Kaeshi Waza">Kaeshi Waza</option>
                          <option value="Renraku Henka Waza">Renraku Henka Waza</option>
                          <option value="Katas">Katas</option>
                          {Array.from<string>(new Set(tecnicas.map(t => t.grupo)))
                            .filter(g => !['Te Waza', 'Koshi Waza', 'Ashi waza', 'Sutemi Waza', 'Ossae Waza', 'Shime Waza', 'Kansetsu Waza', 'Kaeshi Waza', 'Renraku Henka Waza', 'Katas'].includes(g))
                            .filter(Boolean)
                            .sort()
                            .map(tema => (
                            <option key={tema} value={tema}>{tema}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-full md:w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Quantidade</label>
                        <input 
                          type="number" 
                          min="1"
                          value={quantidadeSorteio}
                          disabled
                          className="w-full p-2 border border-slate-300 rounded-md outline-none bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isCoordinator && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <button 
                      onClick={broadcastDraw}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Radio className="w-5 h-5" />
                      Transmitir Sorteio para a Banca
                    </button>
                    <p className="text-xs text-slate-500 text-center mt-2">
                      Clique para enviar as técnicas atuais para a tela dos outros avaliadores.
                    </p>
                  </div>
                )}
              </section>

              {selectedCandidatoId && (
                <>
              {/* Waza Evaluation (Hidden in main view) */}
              {false && selectedTema !== 'Katas' && (
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    Avaliação Técnica (Waza)
                  </h2>
                </div>
                
                {wazaList.length === 0 ? (
                  <p className="text-slate-500 text-sm italic text-center py-4">Nenhuma técnica adicionada.</p>
                ) : (
                  <div className="space-y-4">
                    {wazaList.map((waza, index) => (
                      <div key={waza.id} className="p-4 border border-slate-100 bg-slate-50 rounded-lg relative">
                        {isCoordinator && (
                          <button onClick={() => removeWaza(waza.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="mb-3 pr-8">
                          <input 
                            type="text" 
                            list="tecnicas-list"
                            value={waza.name} 
                            onChange={(e) => updateWaza(waza.id, 'name', e.target.value)}
                            disabled={!isCoordinator}
                            placeholder={`Técnica ${index + 1} (ex: Ippon Seoi Nage)`}
                            className={`w-full p-2 border border-slate-300 rounded-md text-sm font-medium outline-none ${!isCoordinator ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-red-500'}`}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {isHighDan ? (
                            <>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Inovação</label>
                                <select value={waza.kuzushi} onChange={(e) => updateWaza(waza.id, 'kuzushi', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Ótimo">Ótimo</option>
                                  <option value="Bom">Bom</option>
                                  <option value="Regular">Regular</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Eficiência</label>
                                <select value={waza.tsukuri} onChange={(e) => updateWaza(waza.id, 'tsukuri', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Ótimo">Ótimo</option>
                                  <option value="Bom">Bom</option>
                                  <option value="Regular">Regular</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Criatividade</label>
                                <select value={waza.kake} onChange={(e) => updateWaza(waza.id, 'kake', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Ótimo">Ótimo</option>
                                  <option value="Bom">Bom</option>
                                  <option value="Regular">Regular</option>
                                </select>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Kuzushi</label>
                                <select value={waza.kuzushi} onChange={(e) => updateWaza(waza.id, 'kuzushi', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Realizada">Realizada</option>
                                  <option value="Parcialmente Realizada">Parcialmente Realizada</option>
                                  <option value="Não Realizada">Não Realizada</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Tsukuri</label>
                                <select value={waza.tsukuri} onChange={(e) => updateWaza(waza.id, 'tsukuri', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Realizada">Realizada</option>
                                  <option value="Parcialmente Realizada">Parcialmente Realizada</option>
                                  <option value="Não Realizada">Não Realizada</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Kake</label>
                                <select value={waza.kake} onChange={(e) => updateWaza(waza.id, 'kake', e.target.value)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                                  <option value="AVALIAR">AVALIAR</option>
                                  <option value="Realizada">Realizada</option>
                                  <option value="Parcialmente Realizada">Parcialmente Realizada</option>
                                  <option value="Não Realizada">Não Realizada</option>
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isHighDan && selectedTema !== 'Katas' && kihonList.length > 0 && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-red-600" />
                        Avaliação de Kihon
                      </h3>
                      <button 
                        onClick={() => setFullscreenKihonIndex(0)}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                      >
                        <Maximize className="w-4 h-4" /> Modo Tela Cheia
                      </button>
                    </div>
                    <div className="space-y-4">
                      {kihonList.map((kihon) => (
                        <div key={kihon.id} className="p-4 border border-slate-100 bg-slate-50 rounded-lg">
                          <div className="mb-3">
                            <span className="font-semibold text-slate-700">{kihon.name}</span>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Avaliação</label>
                            <select value={kihon.status} onChange={(e) => updateKihon(kihon.id, e.target.value as PhaseStatus)} className="w-full md:w-1/3 p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none">
                              <option value="AVALIAR">AVALIAR</option>
                              <option value="Realizada">Realizada</option>
                              <option value="Parcialmente Realizada">Parcialmente Realizada</option>
                              <option value="Não Realizada">Não Realizada</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Kata Evaluation (Hidden in main view) */}
              {false && selectedTema === 'Katas' && (
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-red-600" />
                    Avaliação de Kata (IJF 2019)
                  </h2>
                  {isCoordinator && (
                    <button onClick={addKata} className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors">
                      <Plus className="w-4 h-4" /> Adicionar Técnica
                    </button>
                  )}
                </div>

                {kataList.length === 0 ? (
                  <p className="text-slate-500 text-sm italic text-center py-4">Nenhuma técnica de Kata adicionada.</p>
                ) : (
                  <div className="space-y-4">
                    {kataList.map((kata, index) => (
                      <div key={kata.id} className={`p-4 border rounded-lg relative ${kata.omitted ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                        {isCoordinator && (
                          <button onClick={() => removeKata(kata.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="mb-3 pr-8 flex gap-4 items-center">
                          <input 
                            type="text" 
                            list="katas-list"
                            value={kata.name} 
                            onChange={(e) => updateKata(kata.id, 'name', e.target.value)}
                            placeholder={`Técnica do Kata ${index + 1}`}
                            className={`flex-1 p-2 border border-slate-300 rounded-md text-sm font-medium outline-none ${kata.omitted || !isCoordinator ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-red-500'}`}
                            disabled={kata.omitted || !isCoordinator}
                          />
                          <label className={`flex items-center gap-2 text-sm font-medium ${!isCoordinator ? 'text-slate-400 cursor-not-allowed' : 'text-red-700 cursor-pointer'}`}>
                            <input type="checkbox" checked={kata.omitted} onChange={(e) => updateKata(kata.id, 'omitted', e.target.checked)} disabled={!isCoordinator} className="w-4 h-4 text-red-600 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                            Omitida
                          </label>
                        </div>
                        
                        {!kata.omitted && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Erros Pequenos (-1)</label>
                              <input type="number" min="0" value={kata.smallErrors} onChange={(e) => updateKata(kata.id, 'smallErrors', parseInt(e.target.value) || 0)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Erros Médios (-3)</label>
                              <input type="number" min="0" value={kata.mediumErrors} onChange={(e) => updateKata(kata.id, 'mediumErrors', parseInt(e.target.value) || 0)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Erros Graves (-5)</label>
                              <input type="number" min="0" value={kata.graveErrors} onChange={(e) => updateKata(kata.id, 'graveErrors', parseInt(e.target.value) || 0)} className="w-full p-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              )}

              {/* High Dan Evaluation */}
              {false && isHighDan && (
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                  <h2 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Critérios para Altas Graduações ({finalTargetDan})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Criatividade</label>
                      <select value={highDanEval.creativity} onChange={(e) => setHighDanEval({...highDanEval, creativity: e.target.value as HighDanScore})} className="w-full p-2 border border-slate-300 rounded-md outline-none">
                        <option value="">Selecione...</option>
                        <option value="Ótimo">Ótimo (Peso 3)</option>
                        <option value="Bom">Bom (Peso 2)</option>
                        <option value="Regular">Regular (Peso 1)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Inovação</label>
                      <select value={highDanEval.innovation} onChange={(e) => setHighDanEval({...highDanEval, innovation: e.target.value as HighDanScore})} className="w-full p-2 border border-slate-300 rounded-md outline-none">
                        <option value="">Selecione...</option>
                        <option value="Ótimo">Ótimo (Peso 3)</option>
                        <option value="Bom">Bom (Peso 2)</option>
                        <option value="Regular">Regular (Peso 1)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eficiência</label>
                      <select value={highDanEval.efficiency} onChange={(e) => setHighDanEval({...highDanEval, efficiency: e.target.value as HighDanScore})} className="w-full p-2 border border-slate-300 rounded-md outline-none">
                        <option value="">Selecione...</option>
                        <option value="Ótimo">Ótimo (Peso 3)</option>
                        <option value="Bom">Bom (Peso 2)</option>
                        <option value="Regular">Regular (Peso 1)</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}
                </>
              )}

              </div>

            {/* Right Column: Generated Report */}
            {selectedCandidatoId && (
              <div className="lg:col-span-1">
              <div className="sticky top-8">
                {showReport && reportData ? (
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900 text-white p-4 text-center">
                      <h3 className="font-bold text-lg uppercase tracking-wider">Parecer Oficial</h3>
                      <p className="text-slate-300 text-sm">{finalCandidateName || 'Candidato'} - {finalTargetDan}</p>
                      {activeAvaliador && <p className="text-slate-400 text-xs mt-1">Avaliador: {activeAvaliador.nome}</p>}
                    </div>
                    
                    <div className="p-5 space-y-6 flex-1 overflow-y-auto">
                      {/* Verdict */}
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center p-4 rounded-full mb-2">
                          {reportData.verdict === 'Aprovado' && <CheckCircle className="w-16 h-16 text-emerald-500" />}
                          {reportData.verdict === 'Pendente' && <AlertTriangle className="w-16 h-16 text-amber-500" />}
                          {reportData.verdict === 'Reprovado' && <XCircle className="w-16 h-16 text-red-500" />}
                        </div>
                        <h4 className={`text-2xl font-black uppercase tracking-widest ${
                          reportData.verdict === 'Aprovado' ? 'text-emerald-600' : reportData.verdict === 'Pendente' ? 'text-amber-600' : 'text-red-600'
                        }`}>{reportData.verdict}</h4>
                        {reportData.pendingReasons.length > 0 && (
                          <div className="mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 text-left">
                            <span className="font-bold">Motivo(s):</span>
                            <ul className="list-disc pl-4 mt-1">
                              {reportData.pendingReasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>

                      <hr className="border-slate-100" />

                      {/* 1. Resumo */}
                      {selectedTema !== 'Katas' && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span className="bg-red-100 text-red-800 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">1</span>
                            Resumo de Desempenho (Waza)
                          </h5>
                          <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-black text-slate-700">{reportData.wazaPercentage !== null ? `${reportData.wazaPercentage}%` : 'N/A'}</span>
                            <span className="text-sm text-slate-500 mb-1">pontos obtidos ({reportData.totalPoints}/{reportData.totalPossiblePoints})</span>
                          </div>
                          {reportData.pedagogicalObs.length > 0 && (
                            <div className="mt-3 bg-slate-50 p-3 rounded-md border border-slate-200 text-sm">
                              <span className="font-semibold text-slate-700 block mb-1">Observações Pedagógicas:</span>
                              <ul className="space-y-1 text-slate-600">
                                {reportData.pedagogicalObs.map((obs, i) => (
                                  <li key={i} className="flex items-start gap-1"><ChevronRight className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><span>{obs}</span></li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Kata */}
                      {selectedTema === 'Katas' && kataList.length > 0 && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span className="bg-red-100 text-red-800 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                              {selectedTema === 'Katas' ? '1' : '2'}
                            </span>
                            Análise de Kata
                          </h5>
                          <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-black text-slate-700">{reportData.kataPercentage !== null ? `${reportData.kataPercentage}%` : 'N/A'}</span>
                            <span className="text-sm text-slate-500 mb-1">pontos obtidos ({reportData.totalKataScore}/{reportData.maxKataScore})</span>
                          </div>
                          {reportData.kataErrorsList.length > 0 && (
                            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                              <ul className="space-y-2">
                                {reportData.kataErrorsList.map((err, i) => <li key={i} className="border-b border-slate-100 pb-1 last:border-0 last:pb-0">{err}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. High Dan */}
                      {isHighDan && (
                        <div>
                          <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span className="bg-red-100 text-red-800 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                              {selectedTema === 'Katas' ? '2' : '3'}
                            </span>
                            Critérios de Alta Graduação
                          </h5>
                          <p className="text-sm text-slate-600 bg-amber-50 p-3 rounded-md border border-amber-100 italic">
                            O candidato demonstrou capacidade <strong>{highDanEval.creativity || 'não avaliada'}</strong> em criatividade, 
                            nível <strong>{highDanEval.innovation || 'não avaliado'}</strong> de inovação técnica e 
                            eficiência <strong>{highDanEval.efficiency || 'não avaliada'}</strong> na aplicação dos fundamentos.
                          </p>
                        </div>
                      )}

                      {/* 4. Estudo */}
                      <div>
                        <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <span className="bg-red-100 text-red-800 w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                            {selectedTema === 'Katas' 
                              ? (isHighDan ? '3' : '2')
                              : (isHighDan ? '4' : '3')}
                          </span>
                          Sugestão de Estudo
                        </h5>
                        <p className="text-sm text-slate-700 leading-relaxed bg-blue-50 p-3 rounded-md border border-blue-100">
                          {reportData.studySuggestion}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-4">
                      <button onClick={() => window.print()} className="text-sm font-semibold text-slate-600 hover:text-slate-800 underline">
                        Imprimir Parecer
                      </button>
                      <button onClick={handleSave} disabled={isSaving} className={`text-sm font-semibold text-white px-4 py-2 rounded-md transition-colors ${saveSuccess ? 'bg-emerald-500' : 'bg-red-700 hover:bg-red-800'} disabled:opacity-50 flex items-center gap-2`}>
                        <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : saveSuccess ? 'Salvo com Sucesso!' : 'Salvar no Supabase'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            )}
            </div>
          </div>
        )}

        {/* VIEW: RESULTADOS */}
        {mainTab === 'resultados' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-red-600" /> Resultados das Avaliações
              </h2>
              <div className="flex items-center gap-2">
                {isUserAdmin(loggedUser) && selectedResultados.size > 0 && (
                  <button 
                    onClick={() => handleDeleteResultados(Array.from(selectedResultados))}
                    className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Selecionados ({selectedResultados.size})
                  </button>
                )}
                <button 
                  onClick={fetchResultados}
                  disabled={isLoadingResultados}
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isLoadingResultados ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Módulo</label>
                <select value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Todos</option>
                  {Array.from(new Set(aggregatedResultados.map(res => {
                    const modulo = modulos.find(m => m.id === res.modulo_id);
                    return res.isTeorica || res.isProvaTeorica ? res.modulo_nome : (modulo ? modulo.tema : 'Desconhecido');
                  }))).map(tema => (
                    <option key={tema} value={tema}>{tema}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Grau Pretendido</label>
                <select value={filtroGrau} onChange={(e) => setFiltroGrau(e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Todos</option>
                  {Array.from(new Set(aggregatedResultados.map(res => res.grau_pretendido))).map(grau => (
                    <option key={grau} value={grau}>{grau}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Candidato</label>
                <input 
                  type="text" 
                  value={filtroCandidato} 
                  onChange={(e) => setFiltroCandidato(e.target.value)} 
                  placeholder="Buscar por nome..."
                  className="w-full p-2 text-sm border border-slate-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Resultado Final</label>
                <select value={filtroResultado} onChange={(e) => setFiltroResultado(e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-md bg-white outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Todos</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Reprovado">Reprovado</option>
                </select>
              </div>
            </div>

            {isLoadingResultados ? (
              <div className="text-center py-8 text-slate-500">Carregando resultados...</div>
            ) : filteredResultados.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Nenhum resultado encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200">
                      {isUserAdmin(loggedUser) && (
                        <th className="p-3 w-12 text-center">
                          <input 
                            type="checkbox" 
                            className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                            checked={selectedResultados.size === filteredResultados.length && filteredResultados.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedResultados(new Set(filteredResultados.map(r => r.id)));
                              } else {
                                setSelectedResultados(new Set());
                              }
                            }}
                          />
                        </th>
                      )}
                      <th className="p-3 font-semibold">Data</th>
                      <th className="p-3 font-semibold">Candidato</th>
                      <th className="p-3 font-semibold">Grau Pretendido</th>
                      <th className="p-3 font-semibold">Módulo</th>
                      <th className="p-3 font-semibold">Média</th>
                      <th className="p-3 font-semibold">Resultado Final</th>
                      <th className="p-3 font-semibold text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResultados.map((res) => {
                      const candidato = candidatos.find(c => c.id === res.candidato_id);
                      const modulo = modulos.find(m => m.id === res.modulo_id);
                      const nomeCandidato = candidato ? candidato.nome : res.candidato_nome || 'Desconhecido';
                      const temaModulo = res.isTeorica || res.isProvaTeorica ? res.modulo_nome : (modulo ? (modulo.nome || modulo.tema) : 'Desconhecido');
                      const isKatas = modulo?.tema === 'Katas';
                      
                      return (
                        <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                          {isUserAdmin(loggedUser) && (
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                className="rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                checked={selectedResultados.has(res.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedResultados);
                                  if (e.target.checked) {
                                    newSelected.add(res.id);
                                  } else {
                                    newSelected.delete(res.id);
                                  }
                                  setSelectedResultados(newSelected);
                                }}
                              />
                            </td>
                          )}
                          <td className="p-3 text-sm text-slate-600">
                            {res.created_at.includes('T') ? new Date(res.created_at).toLocaleDateString('pt-BR') : res.created_at.split('-').reverse().join('/')}
                          </td>
                          <td className="p-3 font-medium text-slate-800">
                            {nomeCandidato}
                          </td>
                          <td className="p-3 text-sm text-slate-600">
                            {res.grau_pretendido}
                          </td>
                          <td className="p-3 text-sm text-slate-600">
                            {temaModulo} {res.isTeorica && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded ml-1">Teórica</span>}
                            {res.isProvaTeorica && <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded ml-1">Prova</span>}
                          </td>
                          <td className="p-3 text-sm text-slate-600">
                            {res.isTeorica || res.isProvaTeorica
                              ? (res.media_teorica !== null && res.media_teorica !== undefined ? `${res.media_teorica.toFixed(1)}%` : '-')
                              : isKatas 
                                ? (res.nota_kata !== null && res.nota_kata !== undefined ? `${res.nota_kata}%` : '-')
                                : (res.percentual_waza !== null && res.percentual_waza !== undefined ? `${res.percentual_waza}%` : '-')
                            }
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${
                                res.veredito === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' :
                                res.veredito === 'Reprovado' ? 'bg-red-100 text-red-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {res.veredito}
                              </span>
                              {!res.isTeorica && !res.isProvaTeorica && (
                                <span className="text-xs text-slate-400">
                                  {res.avaliadores_count} avaliador{res.avaliadores_count !== 1 ? 'es' : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!res.isTeorica && !res.isProvaTeorica && (
                                <button 
                                  onClick={() => handlePrintResult(res)}
                                  className="text-slate-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                  title="Gerar PDF Detalhado"
                                >
                                  <FileText className="w-5 h-5" />
                                </button>
                              )}
                              {isUserAdmin(loggedUser) && (
                                <button 
                                  onClick={() => handleDeleteResultados([res.id])}
                                  className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                  title="Excluir Avaliação"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {isUserAdmin(loggedUser) && mainTab === 'treinamento' && (
          <TreinamentoCapacitacao loggedUser={loggedUser} loggedRole={loggedRole} />
        )}

      </main>

      {/* Footer / Assinatura da Produtora */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-slate-500 text-sm">Desenvolvido por</span>
            <span className="font-bold text-lg text-slate-800 tracking-tight">
              Judô<span className="text-red-600">Tech</span>
            </span>
          </div>
          <p className="text-xs text-slate-500">Tradição no tatame, inovação na gestão.</p>
        </div>
      </footer>

      {/* Fullscreen Waza Evaluation Mode */}
      {fullscreenWazaIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {fullscreenWazaIndex > releasedWazaIndex ? (
            <div className="flex-1 bg-black flex flex-col items-center justify-center text-white p-6 relative">
              <button 
                onClick={() => setFullscreenWazaIndex(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <XCircle className="w-8 h-8" />
              </button>
              
              <div className="flex flex-col items-center justify-center max-w-3xl text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="space-y-2">
                  <p className="text-red-500 font-bold tracking-widest uppercase text-sm md:text-base">Próxima Técnica</p>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-wider uppercase text-white drop-shadow-lg">
                    {fullscreenWazaIndex === wazaList.length ? 'Critérios Gerais' : (wazaList[fullscreenWazaIndex]?.name || `Técnica ${fullscreenWazaIndex + 1}`)}
                  </h2>
                </div>
                
                <div className="pt-12">
                  {isCoordinator ? (
                    <button
                      disabled={
                        (() => {
                          const modulo = modulos.find(m => m.id === selectedModuloId);
                          if (!modulo || !modulo.avaliadores_ids) return false;
                          
                          // Get all evaluators for this module EXCEPT the coordinator themselves
                          // AND ONLY those who are currently active in the channel
                          const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                            id !== loggedUser?.id && activeEvaluators.includes(id)
                          );
                          
                          // If there are no other evaluators, don't disable
                          if (evaluatorsToWait.length === 0) return false;
                          
                          // If it's the first technique, don't wait for previous
                          if (fullscreenWazaIndex === 0) return false;
                          
                          // Check if ALL other evaluators have finished this waza
                          const allFinished = evaluatorsToWait.every(id => 
                            (evaluatorsFinishedWaza[id] !== undefined && evaluatorsFinishedWaza[id] >= fullscreenWazaIndex - 1)
                          );
                          
                          return !allFinished;
                        })()
                      }
                      onClick={() => {
                        setReleasedWazaIndex(fullscreenWazaIndex);
                        if (channelRef.current) {
                          channelRef.current.send({
                            type: 'broadcast',
                            event: 'release_waza',
                            payload: { index: fullscreenWazaIndex }
                          });
                        }
                      }}
                      className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-red-900/50 hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                    >
                      <span>Liberar Técnica</span>
                      {(() => {
                        const modulo = modulos.find(m => m.id === selectedModuloId);
                        if (!modulo || !modulo.avaliadores_ids) return null;
                        
                        const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                          id !== loggedUser?.id && activeEvaluators.includes(id)
                        );
                        
                        const waitingCount = evaluatorsToWait.filter(id => 
                          (evaluatorsFinishedWaza[id] === undefined || evaluatorsFinishedWaza[id] < fullscreenWazaIndex - 1)
                        ).length;
                        
                        if (waitingCount > 0) {
                          return (
                            <span className="text-sm font-normal text-red-200 ml-2">
                              ({waitingCount} pendente{waitingCount > 1 ? 's' : ''})
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-4 opacity-70">
                      <div className="w-10 h-10 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 font-medium uppercase tracking-widest text-sm">Aguardando liberação do coordenador...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (wazaList[fullscreenWazaIndex] || (isHighDan && fullscreenWazaIndex === wazaList.length)) ? (
            <>
              {/* Header */}
              <div className="bg-slate-800 text-white p-3 sm:p-4 flex flex-col shadow-md relative min-h-[6rem] gap-3">
                
                {/* Top Row: Evaluator and Close Button */}
                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">Avaliador</span>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">{activeAvaliador?.nome || 'Não selecionado'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFullscreenWazaIndex(null)}
                    className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-20"
                    title="Sair do Modo Tela Cheia"
                  >
                    <XCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                </div>

                {/* Middle Row: Technique Name */}
                <div className="flex flex-col items-center justify-center w-full px-2">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-wide text-white drop-shadow-sm uppercase text-center break-words w-full">
                    {fullscreenWazaIndex === wazaList.length ? 'Altas Graduações' : (wazaList[fullscreenWazaIndex]?.name || `Técnica ${fullscreenWazaIndex + 1}`)}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-300 font-medium tracking-wider mt-1">
                    {fullscreenWazaIndex === wazaList.length ? 'CRITÉRIOS GERAIS' : `TÉCNICA ${fullscreenWazaIndex + 1} DE ${wazaList.length}`}
                  </p>
                </div>

                {/* Bottom Row: Candidate Info */}
                <div className="flex flex-col items-center justify-center w-full text-center pb-1">
                  <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">{finalCandidateName}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{candidatos.find(c => c.id === selectedCandidatoId)?.dojo || 'N/A'} • {finalTargetDan}</span>
                </div>
              </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 flex flex-col bg-slate-100">
            <div className="w-full max-w-2xl mx-auto flex flex-col h-full">
              
              {isHighDan && fullscreenWazaIndex === wazaList.length && (
                <div className="w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
                  <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                    <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 border-b pb-3 flex items-center gap-2 text-slate-800">
                      <Award className="w-6 h-6 text-amber-500" />
                      Critérios para Altas Graduações ({finalTargetDan})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Criatividade</label>
                        <select value={highDanEval.creativity} onChange={(e) => setHighDanEval({...highDanEval, creativity: e.target.value as HighDanScore})} className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-slate-50">
                          <option value="">Selecione...</option>
                          <option value="Ótimo">Ótimo (Peso 3)</option>
                          <option value="Bom">Bom (Peso 2)</option>
                          <option value="Regular">Regular (Peso 1)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Inovação</label>
                        <select value={highDanEval.innovation} onChange={(e) => setHighDanEval({...highDanEval, innovation: e.target.value as HighDanScore})} className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-slate-50">
                          <option value="">Selecione...</option>
                          <option value="Ótimo">Ótimo (Peso 3)</option>
                          <option value="Bom">Bom (Peso 2)</option>
                          <option value="Regular">Regular (Peso 1)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Eficiência</label>
                        <select value={highDanEval.efficiency} onChange={(e) => setHighDanEval({...highDanEval, efficiency: e.target.value as HighDanScore})} className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-slate-50">
                          <option value="">Selecione...</option>
                          <option value="Ótimo">Ótimo (Peso 3)</option>
                          <option value="Bom">Bom (Peso 2)</option>
                          <option value="Regular">Regular (Peso 1)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {fullscreenWazaIndex !== null && fullscreenWazaIndex < wazaList.length && (
                <>
              {/* Tabs Header */}
              <div className="flex bg-white rounded-t-xl border-b border-slate-200 overflow-hidden shadow-sm shrink-0">
                <button
                  onClick={() => setFullscreenActiveTab('kuzushi')}
                  className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-sm font-semibold uppercase tracking-wider transition-colors ${
                    fullscreenActiveTab === 'kuzushi' 
                      ? 'bg-red-50 text-red-700 border-b-2 border-red-600' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {isHighDan ? 'Inovação' : 'Kuzushi'}
                </button>
                <button
                  onClick={() => setFullscreenActiveTab('tsukuri')}
                  className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-sm font-semibold uppercase tracking-wider transition-colors ${
                    fullscreenActiveTab === 'tsukuri' 
                      ? 'bg-red-50 text-red-700 border-b-2 border-red-600' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {isHighDan ? 'Eficiência' : 'Tsukuri'}
                </button>
                <button
                  onClick={() => setFullscreenActiveTab('kake')}
                  className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-sm font-semibold uppercase tracking-wider transition-colors ${
                    fullscreenActiveTab === 'kake' 
                      ? 'bg-red-50 text-red-700 border-b-2 border-red-600' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {isHighDan ? 'Aplicabilidade' : 'Kake'}
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-white p-4 sm:p-6 rounded-b-xl shadow-sm border border-t-0 border-slate-200 flex-1 flex flex-col justify-center">
                
                {fullscreenActiveTab === 'kuzushi' && (
                  <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-6 text-center">
                      Avalie {isHighDan ? 'a Inovação' : 'o Kuzushi (Desequilíbrio)'}
                    </h3>
                    <div className="flex flex-col gap-2 sm:gap-3">
                      {(isHighDan ? ['Ótimo', 'Bom', 'Regular'] : ['Realizada', 'Parcialmente Realizada', 'Não Realizada']).map(option => (
                        <button
                          key={option}
                          onClick={() => handleFullscreenEval(wazaList[fullscreenWazaIndex].id, 'kuzushi', option)}
                          className={`w-full py-2.5 px-4 sm:py-4 sm:px-6 rounded-lg font-medium text-sm sm:text-lg transition-all border-2 ${
                            wazaList[fullscreenWazaIndex].kuzushi === option 
                              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm scale-[1.02]' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-slate-50'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {fullscreenActiveTab === 'tsukuri' && (
                  <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-6 text-center">
                      Avalie {isHighDan ? 'a Eficiência' : 'o Tsukuri (Preparação)'}
                    </h3>
                    <div className="flex flex-col gap-2 sm:gap-3">
                      {(isHighDan ? ['Ótimo', 'Bom', 'Regular'] : ['Realizada', 'Parcialmente Realizada', 'Não Realizada']).map(option => (
                        <button
                          key={option}
                          onClick={() => handleFullscreenEval(wazaList[fullscreenWazaIndex].id, 'tsukuri', option)}
                          className={`w-full py-2.5 px-4 sm:py-4 sm:px-6 rounded-lg font-medium text-sm sm:text-lg transition-all border-2 ${
                            wazaList[fullscreenWazaIndex].tsukuri === option 
                              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm scale-[1.02]' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-slate-50'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {fullscreenActiveTab === 'kake' && (
                  <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-6 text-center">
                      Avalie {isHighDan ? 'a Aplicabilidade' : 'o Kake (Projeção)'}
                    </h3>
                    <div className="flex flex-col gap-2 sm:gap-3">
                      {(isHighDan ? ['Ótimo', 'Bom', 'Regular'] : ['Realizada', 'Parcialmente Realizada', 'Não Realizada']).map(option => (
                        <button
                          key={option}
                          onClick={() => handleFullscreenEval(wazaList[fullscreenWazaIndex].id, 'kake', option)}
                          className={`w-full py-2.5 px-4 sm:py-4 sm:px-6 rounded-lg font-medium text-sm sm:text-lg transition-all border-2 ${
                            wazaList[fullscreenWazaIndex].kake === option 
                              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm scale-[1.02]' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-slate-50'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="bg-white border-t border-slate-200 p-3 sm:p-4 flex justify-between items-center shrink-0">
            <button
              onClick={() => {
                const prevIndex = fullscreenWazaIndex !== null ? Math.max(0, fullscreenWazaIndex - 1) : null;
                if (isCoordinator && prevIndex !== null) {
                  setReleasedWazaIndex(prevIndex);
                  if (channelRef.current) {
                    channelRef.current.send({
                      type: 'broadcast',
                      event: 'release_waza',
                      payload: { index: prevIndex }
                    });
                  }
                }
                setFullscreenWazaIndex(prevIndex);
                setFullscreenActiveTab('kuzushi');
              }}
              disabled={fullscreenWazaIndex === 0}
              className="px-4 py-2 sm:px-6 bg-slate-100 text-slate-700 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors text-sm sm:text-base"
            >
              Anterior
            </button>
            
            <div className="flex gap-1 sm:gap-2">
              {Array.from({ length: wazaList.length + (isHighDan ? 1 : 0) }).map((_, idx) => (
                <button 
                  key={idx} 
                  onClick={() => {
                    if (isCoordinator) {
                      setReleasedWazaIndex(idx);
                      if (channelRef.current) {
                        channelRef.current.send({
                          type: 'broadcast',
                          event: 'release_waza',
                          payload: { index: idx }
                        });
                      }
                    }
                    setFullscreenWazaIndex(idx);
                  }}
                  disabled={idx > 0 && (wazaList[idx-1].kuzushi === 'AVALIAR' || wazaList[idx-1].tsukuri === 'AVALIAR' || wazaList[idx-1].kake === 'AVALIAR')}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${idx === fullscreenWazaIndex ? 'bg-red-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'} disabled:opacity-30`}
                />
              ))}
            </div>

            <button
              disabled={(() => {
                if (fullscreenWazaIndex === null) return false;
                
                const currentNotEvaluated = fullscreenWazaIndex < wazaList.length 
                  ? (wazaList[fullscreenWazaIndex].kuzushi === 'AVALIAR' || wazaList[fullscreenWazaIndex].tsukuri === 'AVALIAR' || wazaList[fullscreenWazaIndex].kake === 'AVALIAR')
                  : (isHighDan && (!highDanEval.creativity || !highDanEval.innovation || !highDanEval.efficiency));

                return currentNotEvaluated;
              })()}
              onClick={() => {
                if (channelRef.current) {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'waza_evaluated',
                    payload: { avaliadorId: loggedUser?.id, index: fullscreenWazaIndex }
                  });
                }
                
                if (fullscreenWazaIndex !== null && fullscreenWazaIndex < wazaList.length - (isHighDan ? 0 : 1)) {
                  const nextIndex = fullscreenWazaIndex + 1;
                  setFullscreenWazaIndex(nextIndex);
                  setFullscreenActiveTab('kuzushi');
                } else {
                  if (!isHighDan && kihonList.length > 0 && selectedTema !== 'Katas') {
                    setFullscreenKihonIndex(0);
                  } else {
                    setShowReport(true);
                    setPendingAutoSave(true);
                  }
                  setFullscreenWazaIndex(null);
                }
              }}
              className="px-4 py-2 sm:px-6 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base"
            >
              <span>{fullscreenWazaIndex !== null && fullscreenWazaIndex < wazaList.length - (isHighDan ? 0 : 1) ? 'Próxima' : (!isHighDan && kihonList.length > 0 && selectedTema !== 'Katas' ? 'Próxima (Kihon)' : 'Concluir')}</span>
            </button>
          </div>
            </>
          ) : (
            <div className="flex-1 bg-black flex flex-col items-center justify-center text-white p-6 relative">
              <button 
                onClick={() => setFullscreenWazaIndex(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <XCircle className="w-8 h-8" />
              </button>
              
              <div className="flex flex-col items-center justify-center max-w-3xl text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="space-y-2">
                  <p className="text-red-500 font-bold tracking-widest uppercase text-sm md:text-base">
                    {fullscreenWazaIndex === 0 ? 'Iniciar Avaliação' : 'Próxima Técnica'}
                  </p>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-wider uppercase text-white drop-shadow-lg">
                    {wazaList[fullscreenWazaIndex]?.name || `Técnica ${fullscreenWazaIndex + 1}`}
                  </h2>
                </div>
                
                <div className="pt-12">
                  {isCoordinator ? (
                    <button
                      disabled={
                        (() => {
                          if (fullscreenWazaIndex === 0) return false;
                          
                          const modulo = modulos.find(m => m.id === selectedModuloId);
                          if (!modulo || !modulo.avaliadores_ids) return false;
                          
                          const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                            id !== loggedUser?.id && activeEvaluators.includes(id)
                          );
                          
                          if (evaluatorsToWait.length === 0) return false;
                          
                          const prevIndex = fullscreenWazaIndex - 1;
                          const allFinished = evaluatorsToWait.every(id => 
                            (evaluatorsFinishedWaza[id] !== undefined && evaluatorsFinishedWaza[id] >= prevIndex)
                          );
                          
                          return !allFinished;
                        })()
                      }
                      onClick={() => {
                        setReleasedWazaIndex(fullscreenWazaIndex);
                        if (channelRef.current) {
                          channelRef.current.send({
                            type: 'broadcast',
                            event: 'release_waza',
                            payload: { index: fullscreenWazaIndex }
                          });
                        }
                      }}
                      className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-red-900/50 hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                    >
                      <span>{fullscreenWazaIndex === 0 ? 'Avaliar Técnica' : 'Liberar Técnica'}</span>
                      {(() => {
                        if (fullscreenWazaIndex === 0) return null;
                        
                        const modulo = modulos.find(m => m.id === selectedModuloId);
                        if (!modulo || !modulo.avaliadores_ids) return null;
                        
                        const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                          id !== loggedUser?.id && activeEvaluators.includes(id)
                        );
                        
                        const prevIndex = fullscreenWazaIndex - 1;
                        const waitingCount = evaluatorsToWait.filter(id => 
                          (evaluatorsFinishedWaza[id] === undefined || evaluatorsFinishedWaza[id] < prevIndex)
                        ).length;
                        
                        if (waitingCount > 0) {
                          return (
                            <span className="text-sm font-normal text-red-200 ml-2">
                              ({waitingCount} pendente{waitingCount > 1 ? 's' : ''})
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-4 opacity-70">
                      <div className="w-10 h-10 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 font-medium uppercase tracking-widest text-sm">Aguardando liberação do coordenador...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Kihon Evaluation Mode */}
      {fullscreenKihonIndex !== null && !isHighDan && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {fullscreenKihonIndex > releasedKihonIndex ? (
            <div className="flex-1 bg-black flex flex-col items-center justify-center text-white p-6 relative">
              <button 
                onClick={() => setFullscreenKihonIndex(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <XCircle className="w-8 h-8" />
              </button>
              
              <div className="flex flex-col items-center justify-center max-w-3xl text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="space-y-2">
                  <p className="text-blue-500 font-bold tracking-widest uppercase text-sm md:text-base">Próximo Fundamento</p>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-wider uppercase text-white drop-shadow-lg">
                    {kihonList[fullscreenKihonIndex]?.name || `Fundamento ${fullscreenKihonIndex + 1}`}
                  </h2>
                </div>
                
                <div className="pt-12">
                  {fullscreenKihonIndex === 0 ? (
                    isCoordinator ? (
                      <button
                        disabled={
                          (() => {
                            const modulo = modulos.find(m => m.id === selectedModuloId);
                            if (!modulo || !modulo.avaliadores_ids) return false;
                            
                            // Get all evaluators for this module EXCEPT the coordinator themselves
                            // AND ONLY those who are currently active in the channel
                            const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                              id !== loggedUser?.id && activeEvaluators.includes(id)
                            );
                            
                            // If there are no other evaluators, don't disable
                            if (evaluatorsToWait.length === 0) return false;
                            
                            // If it's the first kihon, wait for the last Waza to be finished
                            const lastWazaIndex = wazaList.length - 1;
                            if (lastWazaIndex >= 0) {
                              const allFinishedWaza = evaluatorsToWait.every(id => 
                                (evaluatorsFinishedWaza[id] !== undefined && evaluatorsFinishedWaza[id] >= lastWazaIndex)
                              );
                              return !allFinishedWaza;
                            }
                            return false;
                          })()
                        }
                        onClick={() => {
                          setReleasedKihonIndex(0);
                          if (channelRef.current) {
                            channelRef.current.send({
                              type: 'broadcast',
                              event: 'release_kihon',
                              payload: { index: 0 }
                            });
                          }
                        }}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-blue-900/50 hover:scale-105 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                      >
                        <span>Liberar Fundamentos</span>
                        {(() => {
                          const modulo = modulos.find(m => m.id === selectedModuloId);
                          if (!modulo || !modulo.avaliadores_ids) return null;
                          
                          const evaluatorsToWait = modulo.avaliadores_ids.filter(id => 
                            id !== loggedUser?.id && activeEvaluators.includes(id)
                          );
                          
                          let waitingCount = 0;
                          const lastWazaIndex = wazaList.length - 1;
                          if (lastWazaIndex >= 0) {
                            waitingCount = evaluatorsToWait.filter(id => 
                              (evaluatorsFinishedWaza[id] === undefined || evaluatorsFinishedWaza[id] < lastWazaIndex)
                            ).length;
                          }
                          
                          if (waitingCount > 0) {
                            return (
                              <span className="text-sm font-normal text-blue-200 ml-2">
                                ({waitingCount} pendente{waitingCount > 1 ? 's' : ''})
                              </span>
                            );
                          }
                          return null;
                        })()}
                        <ArrowRight className="w-6 h-6" />
                      </button>
                    ) : (
                      <div className="flex flex-col items-center gap-4 opacity-70">
                        <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium uppercase tracking-widest text-sm">Aguardando liberação do coordenador...</p>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => setReleasedKihonIndex(fullscreenKihonIndex)}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-blue-900/50 hover:scale-105 active:scale-95 flex items-center gap-3"
                    >
                      <span>Avaliar Fundamento</span>
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : kihonList[fullscreenKihonIndex] ? (
            <>
              {/* Header */}
              <div className="bg-slate-800 text-white p-3 sm:p-4 flex flex-col shadow-md relative min-h-[6rem] gap-3">
                
                {/* Top Row: Evaluator and Close Button */}
                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">Avaliador</span>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">{activeAvaliador?.nome || 'Não selecionado'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFullscreenKihonIndex(null)}
                    className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-20"
                    title="Sair do Modo Tela Cheia"
                  >
                    <XCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                </div>

                {/* Middle Row: Kihon Name */}
                <div className="flex flex-col items-center justify-center w-full px-2">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-wide text-white drop-shadow-sm uppercase text-center break-words w-full">
                    {kihonList[fullscreenKihonIndex].name}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-300 font-medium tracking-wider mt-1">
                    KIHON {fullscreenKihonIndex + 1} DE {kihonList.length}
                  </p>
                </div>

                {/* Bottom Row: Candidate Info */}
                <div className="flex flex-col items-center justify-center w-full text-center pb-1">
                  <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">{finalCandidateName}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{candidatos.find(c => c.id === selectedCandidatoId)?.dojo || 'N/A'} • {finalTargetDan}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-slate-100 justify-center">
                <div className="w-full max-w-md mx-auto animate-in zoom-in-95 duration-300">
                  <h3 className="text-xl font-semibold text-slate-800 mb-2 text-center">Avaliação do Kihon</h3>
                  <p className="text-sm text-slate-500 mb-8 text-center">Avalie a execução deste fundamento.</p>
                  
                  <div className="space-y-4">
                    {['Realizada', 'Parcialmente Realizada', 'Não Realizada'].map(option => (
                      <button
                        key={option}
                        onClick={() => {
                          updateKihon(kihonList[fullscreenKihonIndex].id, option as PhaseStatus);
                        }}
                        className={`w-full py-5 px-6 rounded-xl font-medium text-xl transition-all border-2 ${
                          kihonList[fullscreenKihonIndex].status === option 
                            ? 'bg-green-50 border-green-500 text-green-700 shadow-md scale-[1.02]' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:bg-slate-50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
                <button
                  onClick={() => {
                    if (fullscreenKihonIndex === 0) {
                      setFullscreenKihonIndex(null);
                      if (wazaList.length > 0) {
                        setFullscreenWazaIndex(wazaList.length - 1);
                        setFullscreenActiveTab('kake');
                      }
                    } else {
                      const prevIndex = fullscreenKihonIndex - 1;
                      setFullscreenKihonIndex(prevIndex);
                    }
                  }}
                  className="px-6 py-2 bg-slate-100 text-slate-700 rounded-md font-medium hover:bg-slate-200 transition-colors"
                >
                  Anterior
                </button>
                
                <div className="flex gap-2">
                  {kihonList.map((_, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => {
                        setFullscreenKihonIndex(idx);
                      }}
                      disabled={idx > 0 && kihonList[idx-1]?.status === 'AVALIAR'}
                      className={`w-3 h-3 rounded-full transition-all ${idx === fullscreenKihonIndex ? 'bg-blue-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'} disabled:opacity-30`}
                      title={kihonList[idx]?.name}
                    />
                  ))}
                </div>

                <button
                  disabled={kihonList[fullscreenKihonIndex]?.status === 'AVALIAR'}
                  onClick={() => {
                    if (channelRef.current) {
                      channelRef.current.send({
                        type: 'broadcast',
                        event: 'kihon_evaluated',
                        payload: { avaliadorId: loggedUser?.id, index: fullscreenKihonIndex }
                      });
                    }
                    
                    if (fullscreenKihonIndex < kihonList.length - 1) {
                      const nextIndex = fullscreenKihonIndex + 1;
                      setFullscreenKihonIndex(nextIndex);
                    } else {
                      setFullscreenKihonIndex(null);
                      setShowReport(true);
                      setPendingAutoSave(true);
                    }
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fullscreenKihonIndex < kihonList.length - 1 ? 'Próxima' : 'Concluir'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
              <Activity className="w-12 h-12 text-blue-500 mb-4 animate-pulse" />
              {isCoordinator ? (
                <>
                  <h2 className="text-2xl font-bold mb-6">Pronto para iniciar o Kihon?</h2>
                  <button 
                    onClick={() => {
                      const maxIndex = kihonList.length - 1;
                      setReleasedKihonIndex(maxIndex);
                      setFullscreenKihonIndex(0);
                      if (channelRef.current) {
                        channelRef.current.send({
                          type: 'broadcast',
                          event: 'release_kihon',
                          payload: { index: maxIndex }
                        });
                      }
                    }}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-blue-900/50 hover:scale-105 active:scale-95"
                  >
                    Avaliar Kihon
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">Aguardando liberação do Coordenador</h2>
                  <p className="text-slate-400">A avaliação do Kihon iniciará em breve.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Kata Evaluation Mode */}
      {selectedTema === 'Katas' && fullscreenKataIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
          {fullscreenKataIndex > releasedKataIndex ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
              <BookOpen className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
              {isCoordinator ? (
                <>
                  <h2 className="text-2xl font-bold mb-6">Pronto para iniciar a avaliação de Katas?</h2>
                  <button 
                    onClick={() => {
                      const maxIndex = kataList.length - 1;
                      setReleasedKataIndex(maxIndex);
                      setFullscreenKataIndex(0);
                      if (channelRef.current) {
                        channelRef.current.send({
                          type: 'broadcast',
                          event: 'release_kata',
                          payload: { index: maxIndex }
                        });
                      }
                    }}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xl transition-all shadow-lg shadow-red-900/50 hover:scale-105 active:scale-95"
                  >
                    Avaliar Katas
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">Aguardando liberação do Coordenador</h2>
                  <p className="text-slate-400">A avaliação de Katas iniciará em breve.</p>
                </>
              )}
              <button 
                onClick={() => setFullscreenKataIndex(null)}
                className="mt-8 text-slate-500 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest"
              >
                Voltar para o Painel
              </button>
            </div>
          ) : kataList[fullscreenKataIndex] ? (
            <>
            {/* Header */}
              <div className="bg-slate-800 text-white p-3 sm:p-4 flex flex-col shadow-md relative min-h-[6rem] gap-3">
                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">Avaliador</span>
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">{activeAvaliador?.nome || 'Não selecionado'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFullscreenKataIndex(null)}
                    className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white z-20"
                    title="Sair do Modo Tela Cheia"
                  >
                    <XCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                  </button>
                </div>

                {/* Middle Row: Technique Name */}
                <div className="flex flex-col items-center justify-center w-full px-2">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-wide text-white drop-shadow-sm uppercase text-center break-words w-full">
                    {kataList[fullscreenKataIndex].name || `Técnica ${fullscreenKataIndex + 1}`}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-300 font-medium tracking-wider mt-1">
                    TÉCNICA {fullscreenKataIndex + 1} DE {kataList.length}
                  </p>
                </div>

                {/* Bottom Row: Candidate Info */}
                <div className="flex flex-col items-center justify-center w-full text-center pb-1">
                  <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">{finalCandidateName}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{candidatos.find(c => c.id === selectedCandidatoId)?.dojo || 'N/A'} • {finalTargetDan}</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 flex flex-col bg-slate-100 justify-center">
                <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6">
                  
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 text-center mb-4 sm:mb-6 uppercase tracking-wider">Avaliação de Erros</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* Erros Pequenos */}
                      <div className="flex flex-col items-center p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider mb-2 text-center">Pequenos (-1)</span>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button 
                            onClick={() => {
                              updateKata(kataList[fullscreenKataIndex].id, 'smallErrors', Math.max(0, kataList[fullscreenKataIndex].smallErrors - 1));
                              if (channelRef.current && loggedUser) {
                                channelRef.current.send({
                                  type: 'broadcast',
                                  event: 'kata_evaluated',
                                  payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                });
                              }
                            }}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 font-bold transition-colors text-lg"
                          >
                            -
                          </button>
                          <span className="text-xl sm:text-2xl font-black text-slate-800 w-6 sm:w-8 text-center">{kataList[fullscreenKataIndex].smallErrors}</span>
                          <button 
                            onClick={() => {
                              if (kataList[fullscreenKataIndex].smallErrors < 2) {
                                updateKata(kataList[fullscreenKataIndex].id, 'smallErrors', kataList[fullscreenKataIndex].smallErrors + 1);
                                if (channelRef.current && loggedUser) {
                                  channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'kata_evaluated',
                                    payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                  });
                                }
                              }
                            }}
                            disabled={kataList[fullscreenKataIndex].smallErrors >= 2}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 font-bold transition-colors text-lg"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Erros Médios */}
                      <div className="flex flex-col items-center p-3 sm:p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <span className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-wider mb-2 text-center">Médios (-3)</span>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button 
                            onClick={() => {
                              updateKata(kataList[fullscreenKataIndex].id, 'mediumErrors', Math.max(0, kataList[fullscreenKataIndex].mediumErrors - 1));
                              if (channelRef.current && loggedUser) {
                                channelRef.current.send({
                                  type: 'broadcast',
                                  event: 'kata_evaluated',
                                  payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                });
                              }
                            }}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-200 hover:bg-amber-300 flex items-center justify-center text-amber-800 font-bold transition-colors text-lg"
                          >
                            -
                          </button>
                          <span className="text-xl sm:text-2xl font-black text-amber-900 w-6 sm:w-8 text-center">{kataList[fullscreenKataIndex].mediumErrors}</span>
                          <button 
                            onClick={() => {
                              if (kataList[fullscreenKataIndex].mediumErrors < 1) {
                                updateKata(kataList[fullscreenKataIndex].id, 'mediumErrors', kataList[fullscreenKataIndex].mediumErrors + 1);
                                if (channelRef.current && loggedUser) {
                                  channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'kata_evaluated',
                                    payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                  });
                                }
                              }
                            }}
                            disabled={kataList[fullscreenKataIndex].mediumErrors >= 1}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-200 hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-amber-800 font-bold transition-colors text-lg"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Erros Graves */}
                      <div className="flex flex-col items-center p-3 sm:p-4 bg-red-50 rounded-xl border border-red-200">
                        <span className="text-xs sm:text-sm font-bold text-red-700 uppercase tracking-wider mb-2 text-center">Graves (-5)</span>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button 
                            onClick={() => {
                              updateKata(kataList[fullscreenKataIndex].id, 'graveErrors', Math.max(0, kataList[fullscreenKataIndex].graveErrors - 1));
                              if (channelRef.current && loggedUser) {
                                channelRef.current.send({
                                  type: 'broadcast',
                                  event: 'kata_evaluated',
                                  payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                });
                              }
                            }}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-200 hover:bg-red-300 flex items-center justify-center text-red-800 font-bold transition-colors text-lg"
                          >
                            -
                          </button>
                          <span className="text-xl sm:text-2xl font-black text-red-900 w-6 sm:w-8 text-center">{kataList[fullscreenKataIndex].graveErrors}</span>
                          <button 
                            onClick={() => {
                              if (kataList[fullscreenKataIndex].graveErrors < 1) {
                                updateKata(kataList[fullscreenKataIndex].id, 'graveErrors', kataList[fullscreenKataIndex].graveErrors + 1);
                                if (channelRef.current && loggedUser) {
                                  channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'kata_evaluated',
                                    payload: { avaliadorId: loggedUser.id, index: fullscreenKataIndex }
                                  });
                                }
                              }
                            }}
                            disabled={kataList[fullscreenKataIndex].graveErrors >= 1}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-200 hover:bg-red-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-red-800 font-bold transition-colors text-lg"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-6 flex flex-row justify-center gap-2 sm:gap-4">
                      <button
                        onClick={() => {
                          updateKataMultiple(kataList[fullscreenKataIndex].id, {
                            smallErrors: 0,
                            mediumErrors: 0,
                            graveErrors: 0,
                            omitted: false,
                            evaluated: true
                          });
                          if (channelRef.current && loggedUser) {
                            channelRef.current.send({
                              type: 'broadcast',
                              event: 'kata_evaluated',
                              payload: {
                                avaliadorId: loggedUser.id,
                                index: fullscreenKataIndex
                              }
                            });
                          }
                        }}
                        className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-sm sm:text-base flex-1 sm:flex-none text-center ${
                          kataList[fullscreenKataIndex].evaluated && 
                          kataList[fullscreenKataIndex].smallErrors === 0 && 
                          kataList[fullscreenKataIndex].mediumErrors === 0 && 
                          kataList[fullscreenKataIndex].graveErrors === 0 && 
                          !kataList[fullscreenKataIndex].omitted
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        Sem Erros<span className="hidden sm:inline"> (Perfeito)</span>
                      </button>
                      <label className="flex items-center justify-center gap-2 p-2 sm:p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors flex-1 sm:flex-none">
                        <input 
                          type="checkbox" 
                          checked={kataList[fullscreenKataIndex].omitted} 
                          onChange={(e) => {
                            updateKata(kataList[fullscreenKataIndex].id, 'omitted', e.target.checked);
                            if (channelRef.current && loggedUser) {
                              channelRef.current.send({
                                type: 'broadcast',
                                event: 'kata_evaluated',
                                payload: {
                                  avaliadorId: loggedUser.id,
                                  index: fullscreenKataIndex
                                }
                              });
                            }
                          }} 
                          className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 rounded focus:ring-red-500" 
                        />
                        <span className="font-semibold text-slate-700 text-sm sm:text-base text-center leading-tight">Técnica<br className="sm:hidden"/> Omitida</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="bg-white border-t border-slate-200 p-3 sm:p-4 flex justify-between items-center shadow-lg shrink-0">
                <button
                  onClick={() => {
                    if (fullscreenKataIndex > 0) {
                      const prevIndex = fullscreenKataIndex - 1;
                      setFullscreenKataIndex(prevIndex);
                    }
                  }}
                  disabled={fullscreenKataIndex === 0}
                  className="px-4 py-2 sm:px-6 bg-slate-100 text-slate-700 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors text-sm sm:text-base"
                >
                  Anterior
                </button>
                
                <div className="flex gap-1 sm:gap-2 overflow-x-auto px-2 max-w-[50%] no-scrollbar">
                  {kataList.map((_, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => {
                        setFullscreenKataIndex(idx);
                      }}
                      disabled={idx > 0 && !kataList[idx-1]?.evaluated}
                      className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all shrink-0 ${idx === fullscreenKataIndex ? 'bg-red-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'} disabled:opacity-30`}
                      title={kataList[idx]?.name}
                    />
                  ))}
                </div>

                <button
                  disabled={!kataList[fullscreenKataIndex]?.evaluated}
                  onClick={() => {
                    if (channelRef.current && loggedUser) {
                      channelRef.current.send({
                        type: 'broadcast',
                        event: 'kata_evaluated',
                        payload: {
                          avaliadorId: loggedUser.id,
                          index: fullscreenKataIndex
                        }
                      });
                    }

                    if (fullscreenKataIndex < kataList.length - 1) {
                      const nextIndex = fullscreenKataIndex + 1;
                      setFullscreenKataIndex(nextIndex);
                    } else {
                      setFullscreenKataIndex(null);
                      setShowReport(true);
                      setPendingAutoSave(true);
                    }
                  }}
                  className="px-4 py-2 sm:px-6 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {fullscreenKataIndex < kataList.length - 1 ? 'Próxima' : 'Concluir'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-md shadow-lg border-l-4 font-medium text-sm animate-in slide-in-from-bottom-5 ${
          toastMessage.type === 'error' ? 'bg-white border-red-500 text-slate-800' :
          toastMessage.type === 'success' ? 'bg-white border-emerald-500 text-slate-800' :
          'bg-slate-800 border-slate-600 text-white'
        }`}>
          {toastMessage.text}
        </div>
      )}

      {/* Import from Treinamento Modal */}
      {isImportTreinamentoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                Importar Avaliadores do Treinamento
              </h3>
              <button 
                onClick={() => setIsImportTreinamentoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Selecione os participantes que deseja importar como avaliadores.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedParticipants(new Set(treinamentoParticipants.map(p => p.id)))}
                    className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    Selecionar Todos
                  </button>
                  <button 
                    onClick={() => setSelectedParticipants(new Set())}
                    className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-3 w-12 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedParticipants.size === treinamentoParticipants.length && treinamentoParticipants.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants(new Set(treinamentoParticipants.map(p => p.id)));
                            } else {
                              setSelectedParticipants(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-3 font-semibold text-slate-700">Nome</th>
                      <th className="p-3 font-semibold text-slate-700">Zempo</th>
                      <th className="p-3 font-semibold text-slate-700">Graduação</th>
                      <th className="p-3 font-semibold text-slate-700">Função Sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treinamentoParticipants.map((p, idx) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedParticipants.has(p.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedParticipants);
                              if (e.target.checked) {
                                newSelected.add(p.id);
                              } else {
                                newSelected.delete(p.id);
                              }
                              setSelectedParticipants(newSelected);
                            }}
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-800">{p.nome}</td>
                        <td className="p-3 text-slate-600">{p.zempo || '-'}</td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={p.graduacao} 
                            onChange={(e) => {
                              const newParticipants = [...treinamentoParticipants];
                              newParticipants[idx].graduacao = e.target.value;
                              setTreinamentoParticipants(newParticipants);
                            }} 
                            className="w-full p-1.5 border border-slate-300 focus:border-blue-500 rounded outline-none text-sm" 
                            placeholder="Ex: 1º Dan" 
                          />
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.is_coordenador ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                            {p.is_coordenador ? 'Coordenador' : 'Avaliador'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center rounded-b-xl">
              <div className="text-sm font-medium text-slate-600">
                {selectedParticipants.size} de {treinamentoParticipants.length} selecionados
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsImportTreinamentoModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmImportFromTreinamento}
                  disabled={selectedParticipants.size === 0}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Importar Selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Resultados */}
      {resultadosToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-bold">Confirmar Exclusão</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir {resultadosToDelete.length === 1 ? 'esta avaliação' : `estas ${resultadosToDelete.length} avaliações`}? Esta ação não pode ser desfeita e os dados serão removidos do banco de dados.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setResultadosToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteResultados}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Técnicas */}
      {tecnicasToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-bold">Confirmar Exclusão</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Tem certeza que deseja excluir {tecnicasToDelete.length === 1 ? 'esta técnica' : `estas ${tecnicasToDelete.length} técnicas`}? Esta ação não pode ser desfeita e os dados serão removidos do banco de dados.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setTecnicasToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteTecnicas}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
