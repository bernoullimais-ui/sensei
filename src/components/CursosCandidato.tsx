import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, Award, ChevronRight, FileText, CheckCircle, ChevronLeft, Calendar, Maximize2, RefreshCcw, Info, ChevronDown, ChevronUp, Video, Check, X, MessageSquare, Download, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateCertificatePDF } from '../lib/certificateUtils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReactPlayer from 'react-player/youtube';

const getFormattedVideoUrl = (url: string) => {
  if (!url) return '';
  let formattedUrl = url;
  if (formattedUrl.includes('youtube.com/watch?v=')) {
    formattedUrl = formattedUrl.replace('watch?v=', 'embed/');
  } else if (formattedUrl.includes('youtu.be/')) {
    formattedUrl = formattedUrl.replace('youtu.be/', 'youtube.com/embed/');
  }
  
  if (formattedUrl.includes('youtube.com/embed/')) {
    const separator = formattedUrl.includes('?') ? '&' : '?';
    // rel=0 restricts related videos to the same channel
    // modestbranding=1 removes the YouTube logo from the control bar
    formattedUrl += `${separator}rel=0&modestbranding=1`;
  }
  return formattedUrl;
};

export function CursosCandidato({ previewCourseId, isGestor, userRole: initialUserRole }: { previewCourseId?: string, isGestor?: boolean, userRole?: string } = {}) {
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(initialUserRole || null);
  const [activeTab, setActiveTab] = useState<'cursos' | 'trilhas'>('trilhas');
  const [cursosProgress, setCursosProgress] = useState<{[key: string]: number}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'course' | 'lesson'>('list');
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [filterTrailId, setFilterTrailId] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<{[key: number]: boolean}>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Video states
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoSettings, setVideoSettings] = useState<any>(null);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<{[key: string]: string}>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScores, setQuizScores] = useState<{[key: string]: { correct: number, total: number }}>({});
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Attendance states
  const [attendanceWindow, setAttendanceWindow] = useState<{ active: boolean, expiresAt: number | null }>({ active: false, expiresAt: null });
  const [attendanceTimeLeft, setAttendanceTimeLeft] = useState<number>(0);

  // Multi-video state
  const [currentMultiVideoUrl, setCurrentMultiVideoUrl] = useState<string>('');

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      let uId = null;
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          uId = data.user.id;
          setCurrentUserId(uId);
        }
        
        // Find role if not provided
        if (!initialUserRole) {
          const savedSession = localStorage.getItem('judo_tech_session');
          if (savedSession) {
            try {
              const { role } = JSON.parse(savedSession);
              if (role) setUserRole(role);
            } catch (e) { console.error('Error parsing session in CursosCandidato', e); }
          }
        }
      } catch (err) { console.error(err); }
      fetchCursos(uId);
    };
    init();
  }, []);

  const getStepId = (etapa: any, sIdx: number, eIdx: number) => {
    return etapa.id || `step-${sIdx}-${eIdx}`;
  };

  useEffect(() => {
    if (selectedCurso) {
      if (selectedCurso.configuracao_json?.videoSettings) {
        setVideoSettings(selectedCurso.configuracao_json.videoSettings);
      } else {
        setVideoSettings(null); // default or null
      }
      const loadProgress = async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          
          if (userId) {
            // Fetch from database
            const { data, error } = await supabase
              .from('curso_participantes')
              .select('completed_steps, quiz_scores')
              .eq('curso_id', selectedCurso.id)
              .eq('usuario_id', userId)
              .maybeSingle();
              
            let parsedSteps: string[] = [];
            if (data && data.completed_steps) {
              parsedSteps = data.completed_steps;
            } else {
              // Read local storage as fallback
              const stored = localStorage.getItem(`progresso_curso_${selectedCurso.id}_${userId}`);
              if (stored) {
                try { parsedSteps = JSON.parse(stored); } catch { parsedSteps = []; }
              }
              // Sync initial
              syncProgressToDb(selectedCurso, parsedSteps, data?.quiz_scores || {}, userId);
            }
            if (data && data.quiz_scores) {
              setQuizScores(data.quiz_scores);
            }
            setCompletedSteps(parsedSteps);
          } else {
            // No user, fallback
            const stored = localStorage.getItem(`progresso_curso_${selectedCurso.id}`);
            let parsedSteps: string[] = [];
            if (stored) {
              try { parsedSteps = JSON.parse(stored); } catch { parsedSteps = []; }
            }
            setCompletedSteps(parsedSteps);
          }
        } catch (err) {
          console.error("Error loading progress", err);
        }
      };

      loadProgress();
      
      setExpandedSections({ 0: true });

      if (!selectedLesson && selectedCurso.curriculo_json && selectedCurso.curriculo_json[0]?.etapas?.[0]) {
        // Commenting out or removing the auto-selection of the first lesson
        // So that it shows the "Visão Geral" by default
        // const firstStep = selectedCurso.curriculo_json[0].etapas[0];
        // setSelectedLesson({ ...firstStep, _calculatedId: getStepId(firstStep, 0, 0), cursoNome: selectedCurso.nome, secaoNome: selectedCurso.curriculo_json[0].nome, secaoIdx: 0, etapaIdx: 0 });
      }
    }
  }, [selectedCurso]);

  useEffect(() => {
    if (selectedLesson) {
      const isCompleted = completedSteps.includes(selectedLesson._calculatedId);
      setVideoProgress(isCompleted ? 1 : 0);
      setVideoWatched(isCompleted);

      if (selectedLesson.tipo === 'multi_video' && selectedLesson.videos?.length > 0) {
        setCurrentMultiVideoUrl(selectedLesson.videos[0].url);
      }

      if (selectedLesson.tipo === 'quiz') {
        loadQuizQuestions();
      }
      
      // Setup chat for live lesson
      if (selectedLesson.tipo === 'ao_vivo') {
      const channel = supabase.channel(`live_chat_${selectedLesson._calculatedId}`)
        .on('broadcast', { event: 'new_message' }, payload => {
          setChatMessages(prev => [...prev, payload.payload]);
        })
        .on('broadcast', { event: 'release_attendance' }, payload => {
          setAttendanceWindow({ active: true, expiresAt: payload.payload.expiresAt });
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      }
      }
    }
  }, [selectedLesson]);

  useEffect(() => {
    if (attendanceWindow.active && attendanceWindow.expiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((attendanceWindow.expiresAt! - Date.now()) / 1000));
        setAttendanceTimeLeft(remaining);
        if (remaining === 0) {
          setAttendanceWindow({ active: false, expiresAt: null });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [attendanceWindow]);

  const handleReleaseAttendance = async () => {
    if (!selectedLesson) return;
    const expiresAt = Date.now() + 3 * 60 * 1000;
    setAttendanceWindow({ active: true, expiresAt });
    await supabase.channel(`live_chat_${selectedLesson._calculatedId}`).send({
      type: 'broadcast',
      event: 'release_attendance',
      payload: { expiresAt }
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedLesson) return;
    
    const { data: userData } = await supabase.auth.getUser();
    let userName = userData?.user?.user_metadata?.nome || userData?.user?.email?.split('@')[0] || 'Usuário';

    if (userData?.user?.id) {
      try {
        const { data: userProfile } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', userData.user.id)
          .maybeSingle();
        
        if (userProfile && userProfile.nome) {
          // Extrair o primeiro nome
          userName = userProfile.nome.split(' ')[0];
        } else {
          // Extrair o primeiro nome do metadata se existir
          if (userData?.user?.user_metadata?.nome) {
            userName = userData.user.user_metadata.nome.split(' ')[0];
          }
        }
      } catch (err) {
        console.error("Error fetching user profile", err);
      }
    }
    
    const message = {
      id: Date.now().toString(),
      text: chatInput,
      user_id: userData?.user?.id || 'anonymous',
      user_name: userName,
      timestamp: new Date().toISOString()
    };
    
    // Add locally immediately for perceived performance
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
    
    // Broadcast to other users
    await supabase.channel(`live_chat_${selectedLesson._calculatedId}`).send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    });
  };

  const loadQuizQuestions = async () => {
    if (!selectedLesson.questoes_ids || selectedLesson.questoes_ids.length === 0) {
      setQuizQuestions([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('questoes_teoricas')
        .select('*')
        .in('id', selectedLesson.questoes_ids);
      
      if (!error && data) {
        // Order according to the array order
        const ordered = selectedLesson.questoes_ids.map((id: string) => data.find((q: any) => q.id === id)).filter(Boolean);
        setQuizQuestions(ordered);
      }
    } catch (err) {
      console.error(err);
    }
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  const toggleStepComplete = (stepId: string, newScores?: any) => {
    if (!stepId) return;
    setCompletedSteps(prev => {
      const newSteps = prev.includes(stepId) && !newScores ? prev.filter(id => id !== stepId) : (prev.includes(stepId) ? prev : [...prev, stepId]);
      if (selectedCurso) {
        try {
          if (currentUserId) {
            localStorage.setItem(`progresso_curso_${selectedCurso.id}_${currentUserId}`, JSON.stringify(newSteps));
          } else {
            localStorage.setItem(`progresso_curso_${selectedCurso.id}`, JSON.stringify(newSteps));
          }
        } catch (e) {
          console.warn("Erro ao salvar progresso do curso em localStorage:", e);
        }
        syncProgressToDb(selectedCurso, newSteps, newScores ? { ...quizScores, ...newScores } : quizScores);
      }
      return newSteps;
    });
  };

  const syncProgressToDb = async (curso: any, steps: string[], currentScores: any = quizScores, explicitUserId?: string) => {
    try {
      const targetUserId = explicitUserId || currentUserId;
      if (!targetUserId) return;
      
      const curriculo = curso.curriculo_json || [];
      let totalEtapas = 0;
      let validStepIds = new Set<string>();
      curriculo.forEach((s: any, sIdx: number) => {
        if (s.etapas) {
          totalEtapas += s.etapas.length;
          s.etapas.forEach((e: any, eIdx: number) => {
            validStepIds.add(e.id || `step-${sIdx}-${eIdx}`);
          });
        }
      });
      const validCompleted = steps.filter(id => validStepIds.has(id));
      let progresso = totalEtapas === 0 ? 0 : Math.round((validCompleted.length / totalEtapas) * 100);
      progresso = Math.min(100, Math.max(0, progresso));
      const status = progresso >= 100 ? 'concluido' : 'andamento';

      await supabase.from('curso_participantes').upsert({
        curso_id: curso.id,
        usuario_id: targetUserId,
        progresso,
        status,
        completed_steps: steps,
        quiz_scores: currentScores,
        updated_at: new Date().toISOString()
      }, { onConflict: 'curso_id,usuario_id' });
    } catch (err) {
      console.error("Error syncing progress", err);
    }
  };

  const goToNextStep = () => {
    if (!selectedCurso || !selectedLesson) return;
    const curriculo = selectedCurso.curriculo_json || [];
    
    const currentStepId = selectedLesson._calculatedId;

    const { secaoIdx, etapaIdx } = selectedLesson;
    const currentSection = curriculo[secaoIdx];

    if (currentSection && etapaIdx + 1 < currentSection.etapas?.length) {
      // Next step in same section
      const nextStep = currentSection.etapas[etapaIdx + 1];
      setSelectedLesson({ ...nextStep, _calculatedId: getStepId(nextStep, secaoIdx, etapaIdx + 1), cursoNome: selectedCurso.nome, secaoNome: currentSection.nome, secaoIdx, etapaIdx: etapaIdx + 1 });
    } else if (secaoIdx + 1 < curriculo.length) {
      // First step in next section
      const nextSection = curriculo[secaoIdx + 1];
      if (nextSection && nextSection.etapas && nextSection.etapas.length > 0) {
        const nextStep = nextSection.etapas[0];
        setExpandedSections(prev => ({ ...prev, [secaoIdx + 1]: true }));
        setSelectedLesson({ ...nextStep, _calculatedId: getStepId(nextStep, secaoIdx + 1, 0), cursoNome: selectedCurso.nome, secaoNome: nextSection.nome, secaoIdx: secaoIdx + 1, etapaIdx: 0 });
      }
    }
  };

  const fetchTrilhas = async () => {
    try {
      const { data: trilhasData, error: trilhasError } = await supabase
        .from('trilhas')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (trilhasError) throw trilhasError;

      const { data: trilhaCursosData, error: trilhaCursosError } = await supabase
        .from('trilha_cursos')
        .select('trilha_id, curso_id');

      if (trilhaCursosError) throw trilhaCursosError;

      const trilhasWithCursos = (trilhasData || []).map(trilha => ({
        ...trilha,
        trilha_cursos: (trilhaCursosData || []).filter(tc => tc.trilha_id === trilha.id)
      }));
      console.log('trilhasWithCursos:', trilhasWithCursos);
      setTrilhas(trilhasWithCursos);
    } catch (err) {
      console.error('Error fetching trilhas:', err);
    }
  };

  const fetchCursos = async (uId?: string | null) => {
    setIsLoading(true);
    try {
      await fetchTrilhas();
      if (previewCourseId) {
        const { data, error } = await supabase
          .from('cursos')
          .select('*')
          .eq('id', previewCourseId)
          .single();
        if (error) throw error;
        setCursos([data]);
        setSelectedCurso(data);
        setView('course');
      } else {
        const { data, error } = await supabase
          .from('cursos')
          .select('*')
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log('Fetched cursos:', data);
        setCursos(data || []);
      }
      
      const targetUserId = uId || currentUserId;
      if (targetUserId) {
        const { data: participacoes, error: pErr } = await supabase
          .from('curso_participantes')
          .select('curso_id, progresso')
          .eq('usuario_id', targetUserId);
          
        if (!pErr && participacoes) {
          const m: {[key: string]: number} = {};
          participacoes.forEach(p => {
             m[p.curso_id] = p.progresso;
          });
          setCursosProgress(m);
        }
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8 text-slate-500">Carregando cursos...</div>;
  }

  const handleDownloadCertificate = async (curso: any) => {
    if (!curso.certificado_template) {
      alert('Nenhum template de certificado configurado para este curso.');
      return;
    }
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      let participationId = userId || 'participante';
      let candidateName = (window as any).loggedUser?.nome || 'Participante';

      if (userId) {
        // Busca o ID do registro de participação para o QR Code de validação
        const { data: partData } = await (supabase
          .from('curso_participantes')
          .select('id, usuarios(nome)')
          .eq('curso_id', curso.id)
          .eq('usuario_id', userId)
          .single() as any);
          
        if (partData) {
          participationId = partData.id;
          const userObj = Array.isArray(partData.usuarios) ? partData.usuarios[0] : partData.usuarios;
          if (userObj?.nome) candidateName = userObj.nome;
        }
      }

      await generateCertificatePDF(curso.certificado_template, {
        id: participationId,
        nome: candidateName,
        dataConclusao: new Date().toLocaleDateString('pt-BR'),
        titulo: curso.nome,
        cargaHoraria: curso.carga_horaria
      });
    } catch (err) {
      console.error('Error generating certificate:', err);
    }
  };

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button onClick={() => setActiveTab('trilhas')} className={`pb-4 px-2 font-bold ${activeTab === 'trilhas' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Trilhas</button>
          <button onClick={() => setActiveTab('cursos')} className={`pb-4 px-2 font-bold ${activeTab === 'cursos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Cursos</button>
        </div>

        {filterTrailId && activeTab === 'cursos' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <PlayCircle className="w-5 h-5"/>
              </div>
              <div>
                <div className="text-sm text-blue-600 font-semibold">Exibindo cursos da trilha:</div>
                <div className="text-lg font-bold text-slate-800">
                  {trilhas.find(t => t.id === filterTrailId)?.nome}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setFilterTrailId(null)}
              className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4"/> Limpar Filtro
            </button>
          </div>
        )}

        {activeTab === 'cursos' ? (
          (() => {
            const coursesToDisplay = filterTrailId 
              ? cursos.filter(c => {
                  const trail = trilhas.find(t => t.id === filterTrailId);
                  return trail?.trilha_cursos?.some((tc: any) => tc.curso_id === c.id);
                })
              : cursos;

            return coursesToDisplay.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum curso disponível</h3>
              <p className="text-slate-500">No momento, não há cursos publicados.</p>
            </div>
          ) : (
            coursesToDisplay.map((curso: any) => (
              <div key={curso.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
                  <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-800 border border-slate-200 bg-cover bg-center" style={{ backgroundImage: curso.thumbnail_url ? `url("${curso.thumbnail_url}")` : undefined }}>
                    {!curso.thumbnail_url && curso.nome}
                  </div>
                <div className="flex gap-2 w-full justify-center">
                  {curso.em_breve ? (
                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full border border-emerald-200 uppercase tracking-widest animate-pulse">Em Breve</span>
                  ) : userRole === 'avaliador' ? (
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                      <Award className="w-3 h-3" /> Cortesia
                    </span>
                  ) : curso.preco === 'pago' && curso.valor ? (
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">R$ {curso.valor.toFixed(2)}</span>
                  ) : (
                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">Gratuito</span>
                  )}
                </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{curso.nome}</h2>
                  <p className="text-slate-600 mb-4 flex-1">{curso.descricao || 'Nenhuma descrição fornecida.'}</p>
                  
                  {(curso.professor_nome || curso.professor_foto_url) && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      {curso.professor_foto_url ? (
                        <img src={curso.professor_foto_url} alt={curso.professor_nome || 'Professor'} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                          {(curso.professor_nome || 'P').charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{curso.professor_nome || 'Instrutor'}</div>
                        {curso.professor_titulo && <div className="text-xs text-slate-500">{curso.professor_titulo}</div>}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium mb-4">
                    {curso.carga_horaria && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {curso.carga_horaria}</span>}
                    <span className="flex items-center gap-1.5 capitalize"><PlayCircle className="w-4 h-4" /> {curso.ritmo === 'programado' ? 'Programado' : 'Ritmo próprio'}</span>
                    {curso.tempo && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {curso.tempo === 'com_limite' ? `${curso.duracao} ${curso.duracao_tipo}` : 'Sem limite'}</span>}
                    {curso.tem_certificado && <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Certificado incluso</span>}
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    {cursosProgress[curso.id] !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-600">Progresso</span>
                          <span className="text-xs font-semibold text-slate-600">{cursosProgress[curso.id]}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${cursosProgress[curso.id]}%` }}></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                         {(cursosProgress[curso.id] !== undefined || userRole === 'avaliador') && (
                            <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-green-200">
                              <CheckCircle className="w-4 h-4"/> 
                              {userRole === 'avaliador' ? 'Acesso Cortesia' : 'Curso Adquirido'}
                            </span>
                         )}
                         {cursosProgress[curso.id] === 100 && curso.certificado_template && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadCertificate(curso);
                              }}
                              className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-blue-200 hover:bg-blue-100"
                            >
                              <Download className="w-4 h-4"/> Certificado
                            </button>
                         )}
                      </div>
                      <button 
                        disabled={!!curso.em_breve}
                        onClick={() => {
                          setSelectedCurso(curso);
                          setView('course');
                        }}
                        className={`px-6 py-2 ${curso.em_breve ? 'bg-slate-300 cursor-not-allowed text-slate-500' : (cursosProgress[curso.id] !== undefined || userRole === 'avaliador' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700')} text-white rounded-full font-medium flex items-center gap-2 transition-colors`}
                      >
                        {curso.em_breve ? 'Indisponível' : (cursosProgress[curso.id] !== undefined || userRole === 'avaliador' ? 'Continuar Curso' : 'Acessar Curso')} <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          );
        })()
      ) : (
          trilhas.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma trilha disponível</h3>
              <p className="text-slate-500">No momento, não há trilhas publicadas.</p>
            </div>
          ) : (
             <div className="space-y-4">
                {trilhas.map((trilha) => (
                    <div key={trilha.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
                          <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-800 border border-slate-200 bg-cover bg-center" style={{ backgroundImage: trilha.capa_url ? `url("${trilha.capa_url}")` : undefined }}>
                            {!trilha.capa_url && trilha.nome}
                          </div>
                        <div className="flex gap-2 w-full justify-center">
                          {trilha.em_breve ? (
                            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full border border-emerald-200 uppercase tracking-widest animate-pulse">Em Breve</span>
                          ) : userRole === 'avaliador' ? (
                            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                              <Award className="w-3 h-3" /> Cortesia
                            </span>
                          ) : parseFloat(trilha.preco) === 0 ? (
                            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">Gratuito</span>
                          ) : (
                            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">R$ {parseFloat(trilha.preco).toFixed(2)}</span>
                          )}
                        </div>
                        </div>
                         <div className="flex-1 flex flex-col">
                          <h2 className="text-2xl font-bold text-slate-900 mb-2">{trilha.nome}</h2>
                          <p className="text-slate-600 mb-4 flex-1">{trilha.descricao || 'Nenhuma descrição fornecida.'}</p>
                          
                          <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm space-y-2">
                             <div className="flex items-center gap-3 mb-2">
                               {trilha.coordenador_foto_url ? (
                                 <img src={trilha.coordenador_foto_url} alt={trilha.coordenador_nome} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                               ) : (
                                 <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                   {(trilha.coordenador_nome || 'C').charAt(0)}
                                 </div>
                               )}
                               <div>
                                 <div className="font-bold text-slate-800">Coordenador: {trilha.coordenador_nome}</div>
                                 {trilha.coordenador_titulo && <div className="text-xs text-slate-500">{trilha.coordenador_titulo}</div>}
                               </div>
                             </div>
                             <div className="space-y-1">
                                <span className="font-bold">Professores:</span>
                                {(() => {
                                  // 1. Extrair Professores Convidados
                                  let guests: Array<{nome: string, titulo: string}> = [];
                                  const extra = trilha.professores_extra_json || [];
                                  if (Array.isArray(extra) && extra.length > 0) {
                                    guests = extra.map((p: any) => ({ nome: p.nome, titulo: p.titulo }));
                                  } else if (trilha.professores_convidados) {
                                    guests = [{ 
                                      nome: trilha.professores_convidados, 
                                      titulo: trilha.professores_titulos || '' 
                                    }];
                                  }
                                  
                                  // Filtrar convidados vazios e ordenar alfabeticamente
                                  const sortedGuests = guests
                                    .filter(p => p.nome && p.nome.trim() !== '')
                                    .sort((a, b) => a.nome.localeCompare(b.nome));

                                  // 2. Extrair Professores dos Cursos
                                  const trailCoursesProfessors = (trilha.trilha_cursos || [])
                                    .map((tc: any) => cursos.find(c => c.id === tc.curso_id))
                                    .filter((c: any) => c && c.professor_nome && c.professor_nome.trim() !== '')
                                    .map((c: any) => ({
                                      nome: c.professor_nome,
                                      titulo: c.professor_titulo || ''
                                    }));

                                  // Deduplicar professores de cursos por nome
                                  const uniqueCourseProfsMap = new Map();
                                  trailCoursesProfessors.forEach(p => {
                                    if (!uniqueCourseProfsMap.has(p.nome)) {
                                      uniqueCourseProfsMap.set(p.nome, p);
                                    }
                                  });

                                  // 3. Remover professores de curso que já estão nos convidados (Prioridade Convidado)
                                  const guestNames = new Set(sortedGuests.map(g => g.nome));
                                  const filteredCourseProfs = Array.from(uniqueCourseProfsMap.values())
                                    .filter(p => !guestNames.has(p.nome)) as Array<{nome: string, titulo: string}>;

                                  // Ordenar professores de curso alfabeticamente
                                  const sortedCourseProfs = filteredCourseProfs.sort((a, b) => a.nome.localeCompare(b.nome));

                                  return (
                                    <div className="pl-0 space-y-1">
                                      {/* Exibir Convidados em Ordem Alfabética */}
                                      {sortedGuests.map((p, idx) => (
                                        <div key={`guest-${idx}`} className="flex flex-col">
                                          <span className="text-slate-800">{p.nome} {p.titulo && <span className="text-slate-500 text-xs italic">({p.titulo})</span>}</span>
                                        </div>
                                      ))}
                                      
                                      {/* Exibir Professores de Curso em Ordem Alfabética (sem duplicatas dos convidados) */}
                                      {sortedCourseProfs.map((p, idx) => (
                                        <div key={`course-${idx}`} className="flex flex-col">
                                          <span className="text-slate-800">{p.nome} {p.titulo && <span className="text-slate-500 text-xs italic">({p.titulo})</span>}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                             </div>
                             <div className="font-bold">Cursos:</div>
                             <ul className="list-disc list-inside">
                                {(() => {
                                  const trailCourses = (trilha.trilha_cursos || [])
                                    .map((tc: any) => cursos.find(c => c.id === tc.curso_id))
                                    .filter((c: any) => c)
                                    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

                                  return trailCourses.map((curso: any) => (
                                    <li key={curso.id} 
                                       className="cursor-pointer hover:text-blue-600 hover:underline transition-colors py-0.5"
                                       onClick={() => {
                                         setSelectedCurso(curso);
                                         setView('course');
                                       }}
                                     >
                                       {curso.nome}
                                     </li>
                                  ));
                                })()}
                             </ul>
                          </div>

                          <div className="flex justify-end mt-auto">
                             <button 
                               disabled={!!trilha.em_breve}
                               onClick={() => {
                                  setFilterTrailId(trilha.id);
                                  setActiveTab('cursos');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`px-6 py-2 ${trilha.em_breve ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full font-medium flex items-center gap-2 transition-colors`}
                             >
                               {trilha.em_breve ? 'Em Breve' : 'Explorar Trilha'} <ChevronRight className="w-4 h-4"/>
                             </button>
                          </div>
                        </div>
                    </div>
                ))}
             </div>
          )
        )}
      </div>
    );
  }

  if (view === 'course' && selectedCurso) {
    const curriculo = selectedCurso.curriculo_json || [];

    // Calculate total progress
    let totalEtapas = 0;
    let etapasConcluidas = 0;
    curriculo.forEach((s: any, sIdx: number) => {
      totalEtapas += (s.etapas?.length || 0);
      s.etapas?.forEach((e: any, eIdx: number) => {
        const stepId = getStepId(e, sIdx, eIdx);
        if (completedSteps.includes(stepId)) {
          etapasConcluidas++;
        }
      });
    });
    const progressoPercent = totalEtapas === 0 ? 0 : Math.round((etapasConcluidas / totalEtapas) * 100);

    let lastSecaoIdx = -1;
    let lastEtapaIdx = -1;
    for (let sIdx = curriculo.length - 1; sIdx >= 0; sIdx--) {
      if (curriculo[sIdx].etapas && curriculo[sIdx].etapas.length > 0) {
        lastSecaoIdx = sIdx;
        lastEtapaIdx = curriculo[sIdx].etapas.length - 1;
        break;
      }
    }
    const isLastStep = selectedLesson && selectedLesson.secaoIdx === lastSecaoIdx && selectedLesson.etapaIdx === lastEtapaIdx;

    return (
      <div className={isGestor ? 'h-full w-full flex overflow-hidden bg-white' : '-mx-4 md:-mx-8 -my-6 bg-white min-h-[calc(100vh-64px)] flex overflow-hidden'}>
        {/* Sidebar */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
          <div className="p-4 border-b border-slate-200">
            {!previewCourseId && (
              <button 
                onClick={() => {
                  setView('list');
                  setSelectedLesson(null);
                }}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium mb-4"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="truncate">{selectedCurso.nome}</span>
              </button>
            )}
            {previewCourseId && (
              <div className="flex items-center gap-2 text-slate-800 font-medium mb-4">
                <span className="truncate">{selectedCurso.nome}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progressoPercent}%` }}></div>
              </div>
              <span className="text-xs font-bold text-slate-700">{progressoPercent}%</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <button 
              onClick={() => setSelectedLesson(null)}
              className={`w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 border-b border-slate-200 text-sm font-medium transition-colors ${!selectedLesson ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Info className={`w-5 h-5 ${!selectedLesson ? 'text-blue-600' : 'text-slate-400'}`} />
              Visão geral
            </button>
            
            {curriculo.map((secao: any, sIdx: number) => {
              const isExpanded = expandedSections[sIdx];
              const numEtapas = secao.etapas?.length || 0;
              const completedInSection = secao.etapas?.filter((e: any, eIdx: number) => completedSteps.includes(getStepId(e, sIdx, eIdx))).length || 0;

              return (
                <div key={sIdx} className="border-b border-slate-200">
                  <button 
                    onClick={() => setExpandedSections(prev => ({...prev, [sIdx]: !isExpanded}))}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{secao.nome || `Seção ${sIdx + 1}`}</h4>
                      <p className="text-xs text-slate-500">{completedInSection}/{numEtapas} etapas</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                  </button>

                  {isExpanded && secao.etapas && (
                    <div>
                      {secao.etapas.map((etapa: any, eIdx: number) => {
                        const stepId = getStepId(etapa, sIdx, eIdx);
                        const isSelected = selectedLesson?._calculatedId === stepId;
                        const isCompleted = completedSteps.includes(stepId);
                        return (
                          <button
                            key={eIdx}
                            onClick={() => {
                              setSelectedLesson({ ...etapa, _calculatedId: stepId, cursoNome: selectedCurso.nome, secaoNome: secao.nome, secaoIdx: sIdx, etapaIdx: eIdx });
                            }}
                            className={`w-full text-left px-5 py-4 flex gap-4 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <div className="mt-0.5">
                              {isCompleted ? (
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center">
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <span className={`text-sm ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>{etapa.nome}</span>
                              <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                                {etapa.tipo === 'video' ? <Video className="w-3.5 h-3.5" /> : (etapa.tipo === 'multi_video' ? <List className="w-3.5 h-3.5" /> : (etapa.tipo === 'quiz' ? <CheckCircle className="w-3.5 h-3.5" /> : (etapa.tipo === 'ao_vivo' ? <Video className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />)))}
                                <span className="text-xs">{etapa.tempo_video || (etapa.tipo === 'video' ? 'Vídeo' : (etapa.tipo === 'multi_video' ? 'Multi-vídeo' : (etapa.tipo === 'quiz' ? 'Quiz' : (etapa.tipo === 'ao_vivo' ? 'Ao vivo' : 'Artigo'))))}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white flex flex-col relative h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {selectedLesson ? (
              <div>
                <div className="p-6 md:p-10 max-w-5xl mx-auto">
                  <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-8">{selectedLesson.nome}</h1>
                  
                  {selectedLesson.tipo === 'video' && selectedLesson.url_video && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden mb-8 shadow-sm">
                      {/* @ts-ignore */}
                      <ReactPlayer
                        url={selectedLesson.url_video.trim()}
                        className="w-full h-full border-0"
                        width="100%"
                        height="100%"
                        controls={true}
                        light={false}
                        onReady={() => console.log('Player ready')}
                        onProgress={(state: any) => {
                          setVideoProgress(state.played);
                          if (videoSettings?.assistirObrigatorio && state.played >= (videoSettings.porcentagem / 100)) {
                            setVideoWatched(true);
                          }
                        }}
                        onEnded={() => {
                          setVideoWatched(true);
                          if (videoSettings?.reproduzirAutomaticamente) {
                             if (!completedSteps.includes(selectedLesson._calculatedId)) {
                               toggleStepComplete(selectedLesson._calculatedId);
                             }
                             goToNextStep();
                          }
                        }}
                      />
                    </div>
                  )}

                  {selectedLesson.tipo === 'multi_video' && (
                    <div className="space-y-6 mb-8">
                      {currentMultiVideoUrl ? (
                         <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-sm">
                           {/* @ts-ignore */}
                           <ReactPlayer
                             url={currentMultiVideoUrl.trim()}
                             className="w-full h-full border-0"
                             width="100%"
                             height="100%"
                             controls={true}
                             playing={true}
                             onProgress={(state: any) => {
                               if (videoSettings?.assistirObrigatorio && state.played >= (videoSettings.porcentagem / 100)) {
                                 setVideoWatched(true);
                               }
                             }}
                             onEnded={() => {
                               // No automatic next for multi-video by default, unless it's the last video?
                               // For now, just mark watched.
                               setVideoWatched(true);
                             }}
                           />
                         </div>
                      ) : (
                        <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 italic border-2 border-dashed border-slate-200">
                          Selecione um vídeo abaixo para reproduzir
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <List className="w-5 h-5 text-blue-600" /> 
                          Coleção de Vídeos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedLesson.videos?.map((video: any, vIdx: number) => (
                            <button
                              key={vIdx}
                              onClick={() => setCurrentMultiVideoUrl(video.url)}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${currentMultiVideoUrl === video.url ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'}`}
                            >
                              <div className={`p-1.5 rounded-full ${currentMultiVideoUrl === video.url ? 'bg-blue-500' : 'bg-slate-100'}`}>
                                <PlayCircle className="w-4 h-4" />
                              </div>
                              <span className="font-medium text-sm line-clamp-1">{video.title || `Vídeo ${vIdx + 1}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedLesson.tipo === 'ao_vivo' && (
                    <div className="flex flex-col gap-6 mb-8">
                      {selectedLesson.url_video && (
                        <div className="aspect-video w-full bg-black rounded-xl overflow-hidden shadow-md">
                          <iframe 
                            src={getFormattedVideoUrl(selectedLesson.url_video)} 
                            className="w-full h-full border-0"
                            allowFullScreen
                            title="Live Player"
                          ></iframe>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 flex flex-col overflow-hidden" style={{ minHeight: '400px', maxHeight: '500px' }}>
                          <div className="bg-white border-b border-slate-200 p-4">
                             <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600"/> Chat ao vivo</h3>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                             <div className="text-center text-xs text-slate-400 my-4">O chat foi iniciado. Seja respeitoso e siga as diretrizes.</div>
                             {chatMessages.map(msg => (
                               <div key={msg.id} className="text-sm">
                                 <span className="font-bold text-slate-700 mr-2">{msg.user_name}:</span>
                                 <span className="text-slate-600">{msg.text}</span>
                               </div>
                             ))}
                          </div>
                          <div className="bg-white border-t border-slate-200 p-3">
                             <div className="flex gap-2 relative">
                                <input 
                                  type="text" 
                                  placeholder="Diga algo..." 
                                  value={chatInput}
                                  onChange={e => setChatInput(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                                  className="w-full px-4 py-2 bg-slate-100 border-transparent rounded-full text-sm outline-none focus:bg-white focus:border-slate-300 border transition-colors pr-16" 
                                />
                                <button 
                                  onClick={sendChatMessage}
                                  disabled={!chatInput.trim()}
                                  className="absolute right-1.5 top-1.5 w-auto px-3 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
                             </div>
                          </div>
                        </div>

                        <div className="lg:col-span-1">
                          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex flex-col items-center justify-center gap-4 text-center h-full min-h-[200px]">
                             <div>
                               <h4 className="font-bold text-red-900 flex items-center justify-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div> 
                                 Confirmação de Presença
                               </h4>
                               {!isGestor && !attendanceWindow.active && !completedSteps.includes(selectedLesson._calculatedId) && (
                                 <p className="text-xs text-red-800 mt-2">A confirmação de presença será liberada pelo gestor durante a aula e ficará disponível por 3 minutos.</p>
                               )}
                               {(attendanceWindow.active || completedSteps.includes(selectedLesson._calculatedId) || isGestor) && (
                                 <p className="text-sm text-red-800 mt-2">Sua presença ficará registrada no relatório do curso.</p>
                               )}
                             </div>
                             
                             {isGestor ? (
                               <button 
                                 onClick={handleReleaseAttendance}
                                 disabled={attendanceWindow.active}
                                 className={`w-full py-3 rounded-xl font-bold transition-colors ${attendanceWindow.active ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white shadow-md'}`}
                               >
                                 {attendanceWindow.active ? `Liberado (${Math.floor(attendanceTimeLeft / 60)}:${String(attendanceTimeLeft % 60).padStart(2, '0')})` : 'Liberar Presença (3 min)'}
                               </button>
                             ) : (
                               <>
                                 {!attendanceWindow.active && !completedSteps.includes(selectedLesson._calculatedId) ? (
                                   <div className="w-full py-3 rounded-xl font-medium bg-red-100/50 text-red-500/50 cursor-not-allowed border border-red-200/50">
                                     Aguardando Liberação...
                                   </div>
                                 ) : (
                                   <button 
                                     onClick={() => {
                                       if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                          toggleStepComplete(selectedLesson._calculatedId);
                                          setAttendanceWindow({ active: false, expiresAt: null });
                                          goToNextStep();
                                       }
                                     }}
                                     className={`w-full py-3 rounded-xl font-bold transition-colors ${completedSteps.includes(selectedLesson._calculatedId) ? 'bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'}`}
                                   >
                                      {completedSteps.includes(selectedLesson._calculatedId) ? 'Presença Confirmada' : `Confirmar Presença (${Math.floor(attendanceTimeLeft / 60)}:${String(attendanceTimeLeft % 60).padStart(2, '0')})`}
                                   </button>
                                 )}
                               </>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedLesson.descricao && selectedLesson.tipo !== 'quiz' && (
                    <div className="prose prose-slate max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: selectedLesson.descricao }} />
                  )}

                  {selectedLesson.tipo === 'quiz' && (
                    <div className="space-y-6">
                      {quizQuestions.length === 0 ? (
                        <div className="text-slate-500 italic p-6 bg-slate-50 rounded-lg text-center">
                          O instrutor não adicionou questões a este quiz ainda.
                        </div>
                      ) : (
                        <>
                          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-blue-900 font-medium">Instruções</p>
                              <p className="text-sm text-blue-800 mt-1">Responda a todas as perguntas abaixo para concluir a etapa. Você pode tentar quantas vezes quiser, as respostas não precisam estar corretas para avançar.</p>
                            </div>
                          </div>
                          
                          <div className="space-y-8 mt-8">
                            {quizQuestions.map((q, qIdx) => (
                              <div key={q.id} className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-5 bg-slate-50 border-b border-slate-200">
                                  <h3 className="font-medium text-slate-900"><span className="text-slate-500 mr-2">{qIdx + 1}.</span> {q.texto}</h3>
                                </div>
                                <div className="p-5 space-y-3">
                                  {['opcao_a', 'opcao_b', 'opcao_c', 'opcao_d', 'opcao_e'].map((letter, optIdx) => {
                                    if (!q[letter]) return null;
                                    const letterChar = String.fromCharCode(65 + optIdx);
                                    const isSelected = quizAnswers[q.id] === letterChar;
                                    const isCorrect = q.gabarito === letterChar;
                                    
                                    let optionClass = 'border-slate-200 hover:border-blue-300';
                                    let bgClass = 'bg-white';
                                    let circleClass = 'border-slate-300';
                                    
                                    if (quizSubmitted) {
                                      if (isSelected) {
                                        if (isCorrect) {
                                          optionClass = 'border-emerald-500';
                                          bgClass = 'bg-emerald-50';
                                          circleClass = 'border-emerald-500 bg-emerald-500 text-white';
                                        } else {
                                          optionClass = 'border-red-500';
                                          bgClass = 'bg-red-50';
                                          circleClass = 'border-red-500 bg-red-500 text-white';
                                        }
                                      } else if (isCorrect) {
                                        optionClass = 'border-emerald-500';
                                        bgClass = 'bg-emerald-50';
                                        circleClass = 'border-emerald-500 bg-emerald-500 text-white';
                                      }
                                    } else if (isSelected) {
                                      optionClass = 'border-blue-500 bg-blue-50';
                                      circleClass = 'border-blue-500 bg-blue-500 text-white';
                                    }
                                    
                                    return (
                                      <label 
                                        key={letter} 
                                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${optionClass} ${bgClass}`}
                                      >
                                        <input 
                                          type="radio" 
                                          name={`question_${q.id}`} 
                                          className="hidden" 
                                          disabled={quizSubmitted}
                                          checked={isSelected}
                                          onChange={() => {
                                            if (!quizSubmitted) {
                                              setQuizAnswers({...quizAnswers, [q.id]: letterChar});
                                            }
                                          }}
                                        />
                                        <div className={`mt-0.5 w-6 h-6 rounded-full border flex flex-shrink-0 items-center justify-center text-xs font-medium ${circleClass}`}>
                                          {!quizSubmitted && isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                          {(quizSubmitted && isSelected && isCorrect) && <Check className="w-3.5 h-3.5" />}
                                          {(quizSubmitted && isSelected && !isCorrect) && <X className="w-3.5 h-3.5" />}
                                          {(quizSubmitted && !isSelected && isCorrect) && <Check className="w-3.5 h-3.5" />}
                                          {(!isSelected && !quizSubmitted) && letterChar}
                                          {(quizSubmitted && !isSelected && !isCorrect) && letterChar}
                                        </div>
                                        <div className="flex-1">
                                          <p className={`text-sm ${quizSubmitted && isCorrect ? 'text-emerald-900 font-medium' : 'text-slate-700'}`}>{q[letter]}</p>
                                          {quizSubmitted && ((isSelected && !isCorrect) || isCorrect) && q.justificativa && (
                                            <div className="mt-3 text-sm p-3 rounded-lg bg-white/50 border border-current opacity-80">
                                              <strong>Justificativa: </strong>{q.justificativa}
                                            </div>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-8 flex justify-end gap-3">
                             {!quizSubmitted ? (
                               <button 
                                 disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                                 onClick={() => {
                                   let correctCount = 0;
                                   quizQuestions.forEach(q => {
                                     if (quizAnswers[q.id] === q.gabarito) correctCount++;
                                   });
                                   const newScore = { correct: correctCount, total: quizQuestions.length };
                                   const newScoresObj = { [selectedLesson._calculatedId]: newScore };
                                   
                                   setQuizScores(prev => ({...prev, ...newScoresObj}));
                                   setQuizSubmitted(true);
                                   
                                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                     toggleStepComplete(selectedLesson._calculatedId, newScoresObj);
                                   } else {
                                     // Just force update db with new scores
                                     syncProgressToDb(selectedCurso, completedSteps, { ...quizScores, ...newScoresObj });
                                   }
                                 }}
                                 className={`px-8 py-3 rounded-full font-medium text-white transition-colors ${Object.keys(quizAnswers).length !== quizQuestions.length ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
                               >
                                 Enviar Respostas
                               </button>
                             ) : (
                               <>
                                 {(() => {
                                   let correctCount = 0;
                                   quizQuestions.forEach(q => {
                                     if (quizAnswers[q.id] === q.gabarito) correctCount++;
                                   });
                                   const scorePercentage = quizQuestions.length > 0 ? (correctCount / quizQuestions.length) : 0;
                                   if (scorePercentage < 0.5) {
                                     return (
                                       <button 
                                         onClick={() => {
                                           setQuizSubmitted(false);
                                           setQuizAnswers({});
                                         }}
                                         className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-full font-medium hover:bg-slate-50 transition-colors shadow-sm"
                                       >
                                         Tentar Novamente
                                       </button>
                                     );
                                   }
                                   return null;
                                 })()}
                                 <button 
                                   onClick={() => {
                                      if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                         toggleStepComplete(selectedLesson._calculatedId);
                                      }
                                      if (isLastStep) {
                                         setView('list');
                                         setSelectedLesson(null);
                                      } else {
                                         goToNextStep();
                                      }
                                   }}
                                   className="px-8 py-3 bg-blue-600 border border-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                 >
                                    {isLastStep ? (
                                      <>Concluir Etapa <CheckCircle className="w-5 h-5"/></>
                                    ) : (
                                      <>Próxima Etapa <ChevronRight className="w-5 h-5"/></>
                                    )}
                                 </button>
                               </>
                             )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!selectedLesson.url_video && !selectedLesson.descricao && selectedLesson.tipo !== 'quiz' && (
                     <div className="text-slate-500 italic p-6 bg-slate-50 rounded-lg text-center">Nenhum conteúdo disponível para esta etapa.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-10 max-w-5xl mx-auto">
                <div className="flex flex-col gap-8 mb-10">
                  <div className="w-full aspect-video bg-slate-100 rounded-2xl border border-slate-200 bg-cover bg-center shadow-lg overflow-hidden flex items-center justify-center" style={{ backgroundImage: selectedCurso.thumbnail_url ? `url("${selectedCurso.thumbnail_url}")` : undefined }}>
                    {!selectedCurso.thumbnail_url && (
                       <div className="text-4xl font-bold text-slate-300 uppercase tracking-widest">{selectedCurso.nome}</div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-6">
                    <div>
                      <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{selectedCurso.nome}</h1>
                      <div className="flex flex-wrap items-center gap-3 text-sm mb-6">
                        {selectedCurso.carga_horaria && (
                          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200">
                            <Clock className="w-4 h-4" /> {selectedCurso.carga_horaria}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200 capitalize">
                          <RefreshCcw className="w-4 h-4" /> {selectedCurso.ritmo === 'programado' ? 'Programado' : 'Ritmo próprio'}
                        </div>
                        {selectedCurso.tempo && (
                          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200">
                            <Calendar className="w-4 h-4" /> {selectedCurso.tempo === 'com_limite' ? `${selectedCurso.duracao} ${selectedCurso.duracao_tipo}` : 'Sem limite de tempo'}
                          </div>
                        )}
                        {selectedCurso.tem_certificado && (
                          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-bold border border-emerald-200">
                            <Award className="w-4 h-4" /> Certificado Incluso
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 text-slate-100 group-hover:text-slate-200 transition-colors pointer-events-none">
                        <Info className="w-32 h-32 rotate-12" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                          <FileText className="w-4 h-4" />
                        </div>
                        Sobre este curso
                      </h3>
                      <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium">
                        {selectedCurso.descricao || 'Nenhuma descrição detalhada fornecida para este curso.'}
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
                       <button 
                         onClick={() => {
                            if (selectedCurso.curriculo_json && selectedCurso.curriculo_json[0]?.etapas?.[0]) {
                               const firstStep = selectedCurso.curriculo_json[0].etapas[0];
                               setSelectedLesson({ ...firstStep, _calculatedId: getStepId(firstStep, 0, 0), cursoNome: selectedCurso.nome, secaoNome: selectedCurso.curriculo_json[0].nome, secaoIdx: 0, etapaIdx: 0 });
                               setExpandedSections({ 0: true });
                            }
                         }}
                         className="flex items-center gap-3 px-12 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                       >
                         {progressoPercent > 0 ? 'Continuar de onde parei' : 'Iniciar curso agora'} <ChevronRight className="w-6 h-6" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          {selectedLesson && (
            <div className="border-t border-slate-200 bg-white p-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky bottom-0">
              <button 
                disabled={userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))}
                onClick={() => {
                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                      toggleStepComplete(selectedLesson._calculatedId);
                      goToNextStep();
                   } else {
                      toggleStepComplete(selectedLesson._calculatedId);
                   }
                }}
                className={`flex items-center gap-2 font-medium text-sm transition-colors ${
                  userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-blue-600 hover:underline'
                }`}
              >
                {completedSteps.includes(selectedLesson._calculatedId) ? (
                  <><RefreshCcw className="w-4 h-4" /> Desfazer etapa</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Marcar como concluída</>
                )}
              </button>
              
              <button 
                disabled={userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))}
                onClick={() => {
                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                      toggleStepComplete(selectedLesson._calculatedId);
                   }
                   if (isLastStep) {
                      setView('list');
                      setSelectedLesson(null);
                   } else {
                      goToNextStep();
                   }
                }}
                className={`w-full sm:w-auto px-8 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors ${
                  userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isLastStep ? (
                  <>Concluir <CheckCircle className="w-5 h-5"/></>
                ) : (
                  <>Próximo <ChevronRight className="w-5 h-5"/></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
