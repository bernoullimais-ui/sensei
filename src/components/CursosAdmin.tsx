import React, { useState, useEffect } from 'react';
import { Settings, Users, BarChart2, BookOpen, Clock, Lock, PlayCircle, Plus, Eye, Share2, Download, Search, Filter, MoreHorizontal, MessageSquare, Award, CheckCircle, ChevronLeft, Calendar, FileText, Gift, DollarSign, Loader2, Image as ImageIcon, Minus, Code, Video as VideoIcon, ShoppingBag, CalendarCheck, List, Paperclip, Volume2, Pencil, Trash2, Check, X, Table, Bold, Italic, Underline, ListOrdered, GripVertical } from 'lucide-react';
import { motion, Reorder } from 'motion/react';
import { MarketingLinksModal } from './MarketingLinksModal';
import { PricingConfigModal } from './PricingConfigModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import { CursosCandidato } from './CursosCandidato';
import { generateCertificatePDF } from '../lib/certificateUtils';
import CertificateDesigner, { CertificateTemplate } from './CertificateDesigner';
import { TrilhaModal } from './TrilhaModal';

import { ActionModal } from './ActionModal';

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
    formattedUrl += `${separator}rel=0&modestbranding=1`;
  }
  return formattedUrl;
};

export function CursosAdmin() {
  const [view, setView] = useState<'list' | 'create_wizard' | 'course_dashboard'>('list');
  const [wizardStep, setWizardStep] = useState(1);
  const [createdCourseName, setCreatedCourseName] = useState('Tutorial DOJO TV');
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [editingTrilha, setEditingTrilha] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [viewConteudo, setViewConteudo] = useState<'list' | 'edit_section' | 'edit_step_video' | 'edit_step_artigo' | 'edit_step_quiz' | 'edit_step_ao_vivo' | 'edit_step_multi_video'>('list');
  const [editingSection, setEditingSection] = useState<{ id?: string, nome: string, progressiva: boolean, semana: string, dia: string }>({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
  const [editingStep, setEditingStep] = useState<{ id?: string, nome: string, secaoId: string, tipo: string, url_video?: string, descricao?: string, tempo_video?: string, questoes_ids?: string[], videos?: {title: string, url: string}[] }>({ nome: '', secaoId: '', tipo: 'video' });
  const [addingStepToSection, setAddingStepToSection] = useState<string | null>(null);

  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [isSelectQuestionsModalOpen, setIsSelectQuestionsModalOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'confirm' | 'alert', title: string, message: string, onConfirm: () => void}>({ 
    isOpen: false, 
    type: 'confirm', 
    title: '', 
    message: '', 
    onConfirm: () => {} 
  });
  const [displayItems, setDisplayItems] = useState<any[]>([]);

  useEffect(() => {
    // Setup chat for live lesson when editing an existing step
    if (viewConteudo === 'edit_step_ao_vivo' && editingStep.id) {
      const channel = supabase.channel(`live_chat_${editingStep.id}`)
        .on('broadcast', { event: 'new_message' }, payload => {
          setChatMessages(prev => [...prev, payload.payload]);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      }
    } else {
      setChatMessages([]);
    }
  }, [viewConteudo, editingStep.id]);

  const sendLiveMessage = async () => {
    if (!chatInput.trim() || !editingStep.id) return;
    
    const { data: userData } = await supabase.auth.getUser();
    let userName = userData?.user?.user_metadata?.nome || userData?.user?.email?.split('@')[0] || 'Professor';

    if (userData?.user?.id) {
      try {
        const { data: userProfile } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', userData.user.id)
          .maybeSingle();
        
        if (userProfile && userProfile.nome) {
          userName = userProfile.nome.split(' ')[0] + ' (Professor)';
        } else {
          if (userData?.user?.user_metadata?.nome) {
            userName = userData.user.user_metadata.nome.split(' ')[0] + ' (Professor)';
          }
        }
      } catch (err) {
        console.error("Error fetching user profile", err);
      }
    }
    
    const message = {
      id: Date.now().toString(),
      text: chatInput,
      user_id: userData?.user?.id || 'admin',
      user_name: userName,
      timestamp: new Date().toISOString()
    };
    
    // Add locally immediately
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
    
    // Broadcast
    await supabase.channel(`live_chat_${editingStep.id}`).send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    });
  };

  const [newCourseConfig, setNewCourseConfig] = useState({
    nome: '',
    descricao: '',
    ritmo: 'proprio', // proprio, programado
    tempo: 'sem_limite', // sem_limite, com_limite
    duracao: '',
    duracao_tipo: 'Dias',
    preco: 'gratuito', // gratuito, pago
    valor: '',
    professor_nome: '',
    professor_titulo: '',
    professor_foto_url: '',
    thumbnail_url: '',
    carga_horaria: '',
    em_breve: false
  });

  const [activeTab, setActiveTab] = useState<'visao_geral' | 'conteudo' | 'participantes' | 'configuracoes' | 'engajamento' | 'acessar_curso'>('visao_geral');
  const [courseStats, setCourseStats] = useState({ total: 0, andamento: 0, concluido: 0, taxa: 0 });
  const [courseParticipants, setCourseParticipants] = useState<any[]>([]);

  const fetchCourseStats = async (cursoId: string) => {
    try {
      const { data, error } = await supabase.from('curso_participantes').select('*, usuarios(nome, email)').eq('curso_id', cursoId);
      if (error) {
        if (error.code === 'PGRST200') {
          alert(`Erro de relacionamento no banco de dados. Execute no SQL Editor:\n\nALTER TABLE curso_participantes DROP CONSTRAINT IF EXISTS curso_participantes_usuario_id_fkey;\nALTER TABLE curso_participantes ADD CONSTRAINT curso_participantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;\nNOTIFY pgrst, 'reload schema';`);
        } else if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('Could not find the of') || error.message?.includes('quiz_scores')) {
          alert(`Erro no banco de dados. Execute no SQL Editor para criar a tabela ou adicionar as colunas:\n\nCREATE TABLE IF NOT EXISTS curso_participantes (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE,\n  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,\n  status TEXT DEFAULT 'andamento',\n  progresso NUMERIC DEFAULT 0,\n  completed_steps JSONB DEFAULT '[]'::jsonb,\n  quiz_scores JSONB DEFAULT '{}'::jsonb,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n  UNIQUE(curso_id, usuario_id)\n);\n\nALTER TABLE curso_participantes ADD COLUMN IF NOT EXISTS quiz_scores JSONB DEFAULT '{}'::jsonb;\n\nALTER TABLE curso_participantes ENABLE ROW LEVEL SECURITY;\nDROP POLICY IF EXISTS "Todos podem ver participantes" ON curso_participantes;\nCREATE POLICY "Todos podem ver participantes" ON curso_participantes FOR SELECT USING (true);\nDROP POLICY IF EXISTS "Usuarios gerenciam sua participacao" ON curso_participantes;\nCREATE POLICY "Usuarios gerenciam sua participacao" ON curso_participantes FOR ALL USING (auth.uid() = usuario_id);\nNOTIFY pgrst, 'reload schema';`);
        } else {
          console.error("Erro ao carregar estatísticas", error);
        }
        return;
      }
      
      const total = data.length || 0;
      const concluido = data.filter((d: any) => d.status === 'concluido').length || 0;
      const andamento = data.filter((d: any) => d.status === 'andamento').length || 0;
      const taxa = total > 0 ? Math.round((concluido / total) * 100) : 0;
      
      setCourseStats({ total, andamento, concluido, taxa });
      setCourseParticipants(data);
    } catch (err) {
      console.error(err);
    }
  };

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [editingCertTemplate, setEditingCertTemplate] = useState<CertificateTemplate | null>(null);
  
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isTrilhaModalOpen, setIsTrilhaModalOpen] = useState(false);
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);
  const [financialConfig, setFinancialConfig] = useState({ 
    fullPrecoNormal: 497, 
    fullPrecoLancamento: 397,
    fullDataLimite: '2026-06-10',
    trilhas: []
  });

  const [isVideoSettingsModalOpen, setIsVideoSettingsModalOpen] = useState(false);
  const [videoSettings, setVideoSettings] = useState({
    assistirObrigatorio: false,
    porcentagem: 90,
    reproduzirAutomaticamente: false
  });

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [tableCols, setTableCols] = useState(4);
  const [tableRows, setTableRows] = useState(4);
  const artigoTextareaRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (artigoTextareaRef.current && document.activeElement !== artigoTextareaRef.current) {
      if (artigoTextareaRef.current.innerHTML !== (editingStep.descricao || '')) {
        artigoTextareaRef.current.innerHTML = editingStep.descricao || '';
      }
    }
  }, [editingStep.descricao]);

  const applyCommand = (command: string, value: string = '') => {
    if (artigoTextareaRef.current) {
      document.execCommand(command, false, value);
      artigoTextareaRef.current.focus();
      setEditingStep(prev => ({...prev, descricao: artigoTextareaRef.current!.innerHTML}));
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      applyCommand('insertHTML', `<br/><img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; border-radius: 0.5rem; margin-top: 1rem; margin-bottom: 1rem;" /><br/>`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      applyCommand('insertHTML', `<br/><a href="${dataUrl}" download="${file.name}" class="text-blue-600 underline font-medium" target="_blank">📄 Baixar arquivo: ${file.name}</a><br/>`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };


  const [isEditingSettingsModalOpen, setIsEditingSettingsModalOpen] = useState(false);
  const [isConvidarModalOpen, setIsConvidarModalOpen] = useState(false);
  const [convidarEmails, setConvidarEmails] = useState('');
  const [isEnviandoConvites, setIsEnviandoConvites] = useState(false);
  const [editingSettingsData, setEditingSettingsData] = useState({
    nome: '',
    descricao: '',
    thumbnail_url: '',
    tempo: 'sem_limite',
    duracao: '',
    duracao_tipo: 'Dias',
    ritmo: 'proprio',
    preco: 'gratuito',
    valor: '',
    professor_nome: '',
    professor_titulo: '',
    professor_foto_url: '',
    carga_horaria: '',
    em_breve: false
  });

  useEffect(() => {
    fetchCursos();
    fetchQuestoes();
  }, [view]);

  const fetchQuestoes = async () => {
    try {
      const { data, error } = await supabase.from('questoes_teoricas').select('*');
      if (error) {
        console.warn('Error fetching questoes:', error);
      } else {
        setAvailableQuestions(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (view === 'course_dashboard' && createdCourseId) {
      fetchCourseStats(createdCourseId);
      const activeCurso = cursos.find(c => c.id === createdCourseId);
      if (activeCurso?.configuracao_json?.videoSettings) {
        setVideoSettings(activeCurso.configuracao_json.videoSettings);
      }
    }
  }, [view, createdCourseId, cursos]);

  const handleDownloadParticipantCertificate = async (participant: any) => {
    const activeCurso = cursos.find(c => c.id === createdCourseId);
    if (!activeCurso?.certificado_template) {
      alert('Este curso não possui um template de certificado configurado.');
      return;
    }

    try {
      const participantData = {
        id: participant.id,
        nome: participant.usuarios?.nome || participant.usuarios?.email || 'Participante',
        dataConclusao: new Date(participant.updated_at).toLocaleDateString('pt-BR'),
        titulo: activeCurso.nome || 'Certificado de Conclusão',
        cargaHoraria: activeCurso.carga_horaria
      };

      await generateCertificatePDF(activeCurso.certificado_template, participantData);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Erro ao gerar o certificado. Tente novamente.');
    }
  };

  const saveCurriculo = async (newSections: any[]) => {
    if (!createdCourseId) return;
    try {
      const { error } = await supabase
        .from('cursos')
        .update({ curriculo_json: newSections })
        .eq('id', createdCourseId);
      if (error) {
        console.error('Error saving curriculum:', error);
      }
    } catch (err) {
      console.error('Failed to save curriculum:', err);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'SECTION') {
      const newSections = Array.from(sections);
      const [reorderedSection] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, reorderedSection);
      
      setSections(newSections);
      saveCurriculo(newSections);
      return;
    }

    // Default behavior for STEPs
    const sourceSectionId = source.droppableId;
    const destSectionId = destination.droppableId;

    const sourceIdx = source.index;
    const destIdx = destination.index;

    // Need to clone the array and the sections being modified
    const newSections = sections.map(s => ({ ...s, etapas: [...(s.etapas || [])] }));

    // Find sections by ID or index (for legacy support if needed, but we'll prioritize ID)
    let sourceSection = newSections.find(s => s.id === sourceSectionId);
    let destSection = newSections.find(s => s.id === destSectionId);

    // Fallback to index if not found by ID (if we are still using indices as strings)
    if (!sourceSection && !isNaN(parseInt(sourceSectionId))) {
      sourceSection = newSections[parseInt(sourceSectionId)];
    }
    if (!destSection && !isNaN(parseInt(destSectionId))) {
      destSection = newSections[parseInt(destSectionId)];
    }

    if (!sourceSection || !destSection) return;

    const [movedEtapa] = sourceSection.etapas.splice(sourceIdx, 1);
    destSection.etapas.splice(destIdx, 0, movedEtapa);

    setSections(newSections);
    saveCurriculo(newSections);
  };

  const fetchCursos = async () => {
    setIsLoading(true);
    try {
      const [{ data: cursosData, error: cursosError }, { data: trilhasData, error: trilhasError }] = await Promise.all([
        supabase.from('cursos').select('*').order('ordem', { ascending: true, nullsFirst: false }),
        supabase.from('trilhas').select('*').order('ordem', { ascending: true, nullsFirst: false })
      ]);

      if (cursosError) console.error('Error fetching courses:', cursosError);
      if (trilhasError) console.error('Error fetching trilhas:', trilhasError);
      
      const combined = [
        ...(cursosData || []).map(c => ({ ...c, type: 'curso' })),
        ...(trilhasData || []).map(t => ({ ...t, type: 'trilha' }))
      ];
      
      // If none have order, sort by created_at desc
      if (combined.every(i => i.ordem === null)) {
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        combined.sort((a, b) => (a.ordem ?? 999999) - (b.ordem ?? 999999));
      }
      
      setCursos(cursosData || []);
      setTrilhas(trilhasData || []);
      setDisplayItems(combined);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setCursos([]);
      setTrilhas([]);
      setDisplayItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorder = async (newItems: any[]) => {
    setDisplayItems(newItems);
    
    // Sync separate states
    setCursos(newItems.filter(i => i.type === 'curso'));
    setTrilhas(newItems.filter(i => i.type === 'trilha'));
    
    // Updates the DB with the new order
    // To minimize API calls, we could use a single RPC or batch update if supported.
    // Here we'll do promise.all updates.
    
    try {
      const updates = newItems.map((item, index) => {
        const table = item.type === 'curso' ? 'cursos' : 'trilhas';
        return supabase.from(table).update({ ordem: index }).eq('id', item.id);
      });
      
      await Promise.all(updates);
    } catch (err: any) {
      console.error('Error persisting order:', err);
      if (err.message && (err.message.includes("column \"ordem\" of relation") || err.message.includes("does not exist"))) {
        console.warn('Column "ordem" does not exist. Please run the SQL migration.');
        // Show silent warning or alert if it's the first time
      }
    }
  };

  const startWizard = () => {
    setNewCourseConfig({
      nome: '',
      descricao: '',
      ritmo: 'proprio',
      tempo: 'sem_limite',
      duracao: '',
      duracao_tipo: 'Dias',
      preco: 'gratuito',
      valor: '',
      professor_nome: '',
      professor_titulo: '',
      professor_foto_url: '',
      thumbnail_url: '',
      carga_horaria: '',
      em_breve: false
    });
    setWizardStep(1);
    setView('create_wizard');
  };

  const finishWizard = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('cursos')
        .insert([{
          nome: newCourseConfig.nome || 'Novo Programa',
          descricao: newCourseConfig.descricao,
          carga_horaria: newCourseConfig.carga_horaria,
          ritmo: newCourseConfig.ritmo,
          tempo: newCourseConfig.tempo,
          duracao: newCourseConfig.duracao ? parseInt(newCourseConfig.duracao, 10) : null,
          duracao_tipo: newCourseConfig.duracao_tipo,
          preco: newCourseConfig.preco,
          valor: newCourseConfig.valor ? parseFloat(newCourseConfig.valor) : null,
          professor_nome: newCourseConfig.professor_nome,
          professor_titulo: newCourseConfig.professor_titulo,
          professor_foto_url: newCourseConfig.professor_foto_url,
          thumbnail_url: newCourseConfig.thumbnail_url,
          em_breve: newCourseConfig.em_breve,
          status: 'Rascunho'
        }])
        .select();

      if (error) throw error;

      setCreatedCourseName(newCourseConfig.nome || 'Novo Programa');
      if (data && data.length > 0) {
        setCreatedCourseId(data[0].id);
      }
      fetchCursos();
      setView('course_dashboard');
      setActiveTab('visao_geral');
    } catch (err: any) {
      console.error('Error saving course:', err);
      if (err.message && (err.message.includes("does not exist") || err.code === 'PGRST204' || err.message.includes("Could not find the"))) {
        alert(`Erro de banco de dados: coluna não encontrada.\n\nExecute no SQL Editor para adicionar as colunas:\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_nome text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_titulo text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_foto_url text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS descricao text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS carga_horaria text;\nNOTIFY pgrst, 'reload schema';`);
      } else {
        alert('Erro ao salvar o curso. Verifique se a tabela foi criada e tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCertificate = async (template: CertificateTemplate) => {
    console.log('handleSaveCertificate (Curso) called', { createdCourseId, template });
    if (!createdCourseId) {
      alert('Erro: ID do curso não encontrado. Tente recarregar o curso.');
      return;
    }
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('cursos')
        .update({ certificado_template: template })
        .eq('id', createdCourseId);
      
      if (error) throw error;
      
      alert('Template de certificado salvo com sucesso!');
      setIsCertificateModalOpen(false);
      fetchCursos();
    } catch (err: any) {
      console.error('Error saving certificate template:', err);
      if (err.code === '57014') {
        alert('Erro: Tempo limite excedido (DB Timeout). Tente trocar/re-vincular a imagem do certificado para que o sistema a comprima automaticamente.');
      } else {
        alert('Erro ao salvar template do certificado: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderActionModal = () => (
    <ActionModal
      isOpen={modalConfig.isOpen}
      title={modalConfig.title}
      message={modalConfig.message}
      type={modalConfig.type}
      onConfirm={modalConfig.onConfirm}
      onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
    />
  );

  if (view === 'list') {
    return (
      <>
      <div className="bg-slate-50 min-h-screen p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Cursos online</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsMarketingModalOpen(true)}
                className="px-4 py-2 border border-slate-300 rounded-full font-medium hover:bg-slate-100 flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Divulgação
              </button>
              <button 
                onClick={() => setIsPricingModalOpen(true)}
                className="px-4 py-2 border border-slate-300 rounded-full font-medium hover:bg-slate-100 flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" /> Configurar Preços
              </button>
              <button 
                onClick={startWizard}
                className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar Curso
              </button>
              <button 
                onClick={() => setIsTrilhaModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar Trilha
              </button>
            </div>
          </div>
          
          <TrilhaModal 
            isOpen={isTrilhaModalOpen}
            onClose={() => { setIsTrilhaModalOpen(false); setEditingTrilha(null); }}
            fetchTrilhas={fetchCursos}
            editingTrilha={editingTrilha}
          />                
          <PricingConfigModal 
            isOpen={isPricingModalOpen}
            onClose={() => setIsPricingModalOpen(false)}
            onSave={(config) => { setFinancialConfig(config); setIsPricingModalOpen(false); }}
            initialConfig={financialConfig}
            allCourses={cursos}
          />
          <MarketingLinksModal 
            isOpen={isMarketingModalOpen}
            onClose={() => setIsMarketingModalOpen(false)}
            publicBaseUrl={window.location.origin}
            cursos={cursos}
            trilhas={trilhas}
            config={financialConfig}
          />

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-4"></th>
                  <th className="px-6 py-4 font-semibold">Nome</th>
                  <th className="px-6 py-4 font-semibold">Participantes</th>
                  <th className="px-6 py-4 font-semibold">Preço</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              {isLoading ? (
                <tbody className="divide-y divide-slate-100">
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                      <p>Carregando programas...</p>
                    </div>
                  </td>
                </tr>
                </tbody>
              ) : displayItems.length === 0 ? (
                <tbody className="divide-y divide-slate-100">
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">Nenhum programa ou trilha encontrado. Crie um novo.</td>
                </tr>
                </tbody>
              ) : (
                <Reorder.Group axis="y" values={displayItems} onReorder={handleReorder} as="tbody" className="divide-y divide-slate-100">
                  {displayItems.map(item => (
                    <Reorder.Item 
                      key={item.id} 
                      value={item} 
                      as="tr" 
                      className="hover:bg-slate-50 cursor-pointer group"
                    >
                      <td className="px-4 py-4 text-slate-300 group-hover:text-slate-400">
                        <GripVertical className="w-4 h-4 cursor-grab" />
                      </td>
                      {item.type === 'curso' ? (
                        <>
                          <td className="px-6 py-4 font-medium text-slate-900" onClick={() => { 
                            setCreatedCourseName(item.nome); 
                            setCreatedCourseId(item.id); 
                            setSections(item.curriculo_json || []);
                            setView('course_dashboard'); 
                          }}>{item.nome}</td>
                          <td className="px-6 py-4 text-slate-600" onClick={() => { 
                            setCreatedCourseName(item.nome); 
                            setCreatedCourseId(item.id); 
                            setSections(item.curriculo_json || []);
                            setView('course_dashboard'); 
                          }}>0</td>
                          <td className="px-6 py-4 text-slate-600 capitalize" onClick={() => { 
                            setCreatedCourseName(item.nome); 
                            setCreatedCourseId(item.id); 
                            setSections(item.curriculo_json || []);
                            setView('course_dashboard'); 
                          }}>{item.preco || 'Gratuito'}</td>
                          <td className="px-6 py-4" onClick={() => { 
                            setCreatedCourseName(item.nome); 
                            setCreatedCourseId(item.id); 
                            setSections(item.curriculo_json || []);
                            setView('course_dashboard'); 
                          }}>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Publicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{item.status || 'Rascunho'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newStatus = item.status === 'Publicado' ? 'Rascunho' : 'Publicado';
                                  try {
                                    const { error } = await supabase.from('cursos').update({ status: newStatus }).eq('id', item.id);
                                    if (error) throw error;
                                    fetchCursos();
                                  } catch (err) {
                                    console.error('Error updating course status:', err);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                                title={item.status === 'Publicado' ? 'Despublicar' : 'Publicar'}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreatedCourseName(item.nome); 
                                  setCreatedCourseId(item.id); 
                                  setSections(item.curriculo_json || []);
                                  setView('course_dashboard'); 
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalConfig({
                                    isOpen: true,
                                    type: 'confirm',
                                    title: 'Excluir curso',
                                    message: 'Tem certeza que deseja excluir este curso?',
                                    onConfirm: async () => {
                                      setModalConfig(prev => ({ ...prev, isOpen: false }));
                                      try {
                                        const { error } = await supabase.from('cursos').delete().eq('id', item.id);
                                        if (error) throw error;
                                        fetchCursos();
                                      } catch (err) {
                                        console.error('Error deleting course:', err);
                                      }
                                    }
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-slate-900" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>{item.nome} <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Trilha</span></td>
                          <td className="px-6 py-4 text-slate-600" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>0</td>
                          <td className="px-6 py-4 text-slate-600 capitalize" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>Pago</td>
                          <td className="px-6 py-4" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Publicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{item.status || 'Rascunho'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   const newStatus = item.status === 'Publicado' ? 'Rascunho' : 'Publicado';
                                   try {
                                     const { error } = await supabase.from('trilhas').update({ status: newStatus }).eq('id', item.id);
                                     if (error) throw error;
                                     fetchCursos();
                                   } catch (err) {
                                     console.error('Error updating trilha status:', err);
                                   }
                                 }}
                                 className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                                 title={item.status === 'Publicado' ? 'Despublicar' : 'Publicar'}
                               >
                                 <CheckCircle className="w-4 h-4" />
                               </button>
                               <button onClick={(e) => { e.stopPropagation(); setEditingTrilha(item); setIsTrilhaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                                 <Pencil className="w-4 h-4" />
                               </button>
                              <button 
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setModalConfig({
                                     isOpen: true,
                                     type: 'confirm',
                                     title: 'Excluir trilha',
                                     message: 'Tem certeza que deseja excluir esta trilha?',
                                     onConfirm: async () => {
                                       setModalConfig(prev => ({ ...prev, isOpen: false }));
                                       try {
                                         const { error } = await supabase.from('trilhas').delete().eq('id', item.id);
                                         if (error) throw error;
                                         
                                         // Also remove from trilha_cursos
                                         const { error: tcError } = await supabase.from('trilha_cursos').delete().eq('trilha_id', item.id);
                                         if (tcError) throw tcError;

                                         fetchCursos();
                                       } catch (err) {
                                         console.error('Error deleting trilha:', err);
                                       }
                                     }
                                   });
                                 }}
                                 className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </table>
          </div>
        </div>
      </div>
      {renderActionModal()}
      </>
    );
  }

  if (view === 'create_wizard') {
    return (
      <>
      <div className="bg-slate-50 min-h-screen py-8">
        <div className="max-w-3xl mx-auto w-full px-6">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Criar Novo Programa</h1>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8 space-y-10">
              
              {/* Nome do Curso */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Informações do Programa</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do programa <span className="text-blue-600">*</span></label>
                    <input 
                      type="text" 
                      value={newCourseConfig.nome}
                      onChange={(e) => setNewCourseConfig({...newCourseConfig, nome: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                      placeholder="Ex. Desafio de 30 dias"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Curso</label>
                    <textarea 
                      value={newCourseConfig.descricao}
                      onChange={(e) => setNewCourseConfig({...newCourseConfig, descricao: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors bg-white resize-none h-24"
                      placeholder="Descreva sobre o que é o programa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Carga Horária</label>
                    <input 
                      type="text" 
                      value={newCourseConfig.carga_horaria}
                      onChange={(e) => setNewCourseConfig({...newCourseConfig, carga_horaria: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors bg-white"
                      placeholder="Ex. 40 horas"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Professor */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Instrutor / Professor</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Professor</label>
                      <input 
                        type="text" 
                        value={newCourseConfig.professor_nome}
                        onChange={(e) => setNewCourseConfig({...newCourseConfig, professor_nome: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        placeholder="Nome"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título / Especialidade</label>
                      <input 
                        type="text" 
                        value={newCourseConfig.professor_titulo}
                        onChange={(e) => setNewCourseConfig({...newCourseConfig, professor_titulo: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                        placeholder="Ex. Mestre faixa preta"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL da Foto do Professor</label>
                    <input 
                      type="text" 
                      value={newCourseConfig.professor_foto_url}
                      onChange={(e) => setNewCourseConfig({...newCourseConfig, professor_foto_url: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem de Capa</label>
                    <input 
                      type="text" 
                      value={newCourseConfig.thumbnail_url}
                      onChange={(e) => setNewCourseConfig({...newCourseConfig, thumbnail_url: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Ritmo */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Como os participantes concluem o seu programa?</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <label 
                    className={`block border-2 p-5 rounded-xl cursor-pointer transition-all ${newCourseConfig.ritmo === 'proprio' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2"><FileText className="w-6 h-6 text-blue-600" /></div>
                      <div className="flex-1">
                         <span className="block font-bold text-slate-900 mb-1">No seu próprio ritmo</span>
                         <span className="text-sm text-slate-600">Concluem as etapas quando quiserem.</span>
                      </div>
                      <input 
                        type="radio" name="ritmo" className="sr-only" 
                        checked={newCourseConfig.ritmo === 'proprio'} 
                        onChange={() => setNewCourseConfig({...newCourseConfig, ritmo: 'proprio'})} 
                      />
                      {newCourseConfig.ritmo === 'proprio' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </div>
                  </label>

                  <label 
                    className={`block border-2 p-5 rounded-xl cursor-pointer transition-all ${newCourseConfig.ritmo === 'programado' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2"><Calendar className="w-6 h-6 text-slate-700" /></div>
                      <div className="flex-1">
                         <span className="block font-bold text-slate-900 mb-1">Programado</span>
                         <span className="text-sm text-slate-600">Concluem etapas em dias específicos.</span>
                      </div>
                      <input 
                        type="radio" name="ritmo" className="sr-only" 
                        checked={newCourseConfig.ritmo === 'programado'} 
                        onChange={() => setNewCourseConfig({...newCourseConfig, ritmo: 'programado'})} 
                      />
                      {newCourseConfig.ritmo === 'programado' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </div>
                  </label>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Tempo */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Quanto tempo os participantes têm para concluir?</h3>
                <div className="space-y-4">
                  <label 
                    className={`block border-2 p-5 rounded-xl cursor-pointer transition-all ${newCourseConfig.tempo === 'sem_limite' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2"><Clock className="w-6 h-6 text-blue-600" /></div>
                      <div className="flex-1">
                         <span className="block font-bold text-slate-900 mb-1">Sem limite de tempo</span>
                         <span className="text-sm text-slate-600">Os participantes podem concluir as etapas quando quiserem.</span>
                      </div>
                      <input 
                        type="radio" name="tempo" className="sr-only" 
                        checked={newCourseConfig.tempo === 'sem_limite'} 
                        onChange={() => setNewCourseConfig({...newCourseConfig, tempo: 'sem_limite'})} 
                      />
                      {newCourseConfig.tempo === 'sem_limite' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </div>
                  </label>

                  <div className={`border-2 rounded-xl transition-all ${newCourseConfig.tempo === 'com_limite' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
                    <label className="flex items-start gap-4 p-5 cursor-pointer">
                      <div className="p-2"><Calendar className="w-6 h-6 text-slate-700" /></div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-900 mb-1">Limite de tempo</span>
                        <span className="text-sm text-slate-600">Dê aos participantes um número definido de dias para terminar.</span>
                      </div>
                      <input 
                        type="radio" name="tempo" className="sr-only" 
                        checked={newCourseConfig.tempo === 'com_limite'} 
                        onChange={() => setNewCourseConfig({...newCourseConfig, tempo: 'com_limite'})} 
                      />
                      {newCourseConfig.tempo === 'com_limite' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </label>
                    {newCourseConfig.tempo === 'com_limite' && (
                      <div className="px-5 pb-5 pt-2 md:pl-16 flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-sm text-slate-600 mb-1">Duração do programa <span className="text-blue-600">*</span></label>
                          <input 
                            type="number" 
                            value={newCourseConfig.duracao}
                            onChange={(e) => setNewCourseConfig({...newCourseConfig, duracao: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500" 
                            placeholder="Ex.: 5" 
                          />
                        </div>
                        <div className="flex-1 md:pt-6">
                          <select 
                            value={newCourseConfig.duracao_tipo}
                            onChange={(e) => setNewCourseConfig({...newCourseConfig, duracao_tipo: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                          >
                            <option>Dias</option>
                            <option>Semanas</option>
                            <option>Meses</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Preço */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Defina o preço do seu programa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label 
                    className={`block border-2 p-5 rounded-xl cursor-pointer text-center transition-all ${newCourseConfig.preco === 'gratuito' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 text-blue-400 bg-blue-50 rounded p-2"><Gift className="w-full h-full" /></div>
                    <span className="block font-bold text-slate-900">Gratuito</span>
                    <input 
                      type="radio" name="preco" className="sr-only" 
                      checked={newCourseConfig.preco === 'gratuito'} 
                      onChange={() => setNewCourseConfig({...newCourseConfig, preco: 'gratuito'})} 
                    />
                  </label>

                  <label 
                    className={`block border-2 p-5 rounded-xl cursor-pointer text-center transition-all relative ${newCourseConfig.preco === 'pago' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 text-emerald-500 bg-emerald-50 rounded flex items-center justify-center shrink-0"><DollarSign className="w-8 h-8" /></div>
                    <span className="block font-bold text-slate-900">Pago</span>
                    <input 
                      type="radio" name="preco" className="sr-only" 
                      checked={newCourseConfig.preco === 'pago'} 
                      onChange={() => setNewCourseConfig({...newCourseConfig, preco: 'pago'})} 
                    />
                  </label>
                </div>

                {newCourseConfig.preco === 'pago' && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-1">Pagamento único</h4>
                    <p className="text-sm text-slate-600 mb-3">Defina um preço fixo para o seu programa.</p>
                    <div className="max-w-xs relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium h-full flex items-center">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newCourseConfig.valor}
                        onChange={(e) => setNewCourseConfig({...newCourseConfig, valor: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded outline-none focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="wizardEmBreve" 
                    checked={newCourseConfig.em_breve} 
                    onChange={e => setNewCourseConfig({...newCourseConfig, em_breve: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="wizardEmBreve" className="font-semibold text-slate-700 underline decoration-blue-500/30">Marcar como "Em Breve" (Selo verde no lugar do preço)</label>
                </div>
              </div>

            </div>

            <div className="border-t border-slate-200 p-6 flex justify-end bg-slate-50">
              <button 
                onClick={finishWizard}
                disabled={newCourseConfig.nome.trim() === '' || isSaving}
                className={`px-8 py-2.5 rounded-full font-medium text-white transition-colors flex items-center gap-2 ${
                  newCourseConfig.nome.trim() === '' || isSaving ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Criando...</> : 'Criar Programa'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {renderActionModal()}
      </>
    );
  }

  const activeCurso = editingTrilha ? null : cursos.find(c => c.id === createdCourseId);
  const activeTrilha = editingTrilha;
  
  const nomeExibido = editingTrilha ? activeTrilha.nome : createdCourseName;

  const tempoText = activeCurso?.tempo === 'sem_limite' ? 'Sem limite' : (activeCurso?.duracao ? `${activeCurso?.duracao} ${activeCurso?.duracao_tipo}` : 'Sem limite');
  const ritmoText = activeCurso?.ritmo === 'programado' ? 'Programado' : 'Próprio ritmo';
  const precoText = activeCurso?.preco === 'gratuito' ? 'Gratuito' : `Pago`;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 pt-4">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => { setView('list'); setEditingTrilha(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-sm font-medium text-slate-500">
            {editingTrilha ? 'Trilhas' : 'Programas'} <ChevronLeft className="w-3 h-3 inline rotate-180 mx-1" /> <span className="text-slate-900">{nomeExibido}</span>
          </div>
        </div>

        <div className="flex items-center gap-8 text-sm font-medium text-slate-600">
          <button 
            onClick={() => setActiveTab('visao_geral')}
            className={`pb-4 border-b-2 transition-colors ${activeTab === 'visao_geral' ? 'border-primary text-primary font-bold text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
          >
            Visão geral
          </button>
          {!editingTrilha && (
            <>
              <button 
                onClick={() => setActiveTab('conteudo')}
                className={`pb-4 border-b-2 transition-colors ${activeTab === 'conteudo' ? 'border-primary text-primary font-bold text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Conteúdo
              </button>
              <button 
                onClick={() => setActiveTab('participantes')}
                className={`pb-4 border-b-2 transition-colors ${activeTab === 'participantes' ? 'border-primary text-primary font-bold text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Participantes
              </button>
              <button 
                onClick={() => setActiveTab('engajamento')}
                className={`pb-4 border-b-2 transition-colors ${activeTab === 'engajamento' ? 'border-primary text-primary font-bold text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Engajamento
              </button>
              <button 
                onClick={() => setActiveTab('acessar_curso')}
                className={`pb-4 border-b-2 transition-colors ${activeTab === 'acessar_curso' ? 'border-primary text-primary font-bold text-blue-600 border-blue-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Acessar curso
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-8 px-4">
        {activeTab === 'visao_geral' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
              <div className="flex gap-6 items-start">
                <div 
                  className="w-24 h-16 bg-slate-100 border border-slate-200 rounded flex items-center justify-center font-bold text-lg text-slate-800 bg-cover bg-center"
                  style={{ backgroundImage: (activeCurso?.thumbnail_url || activeTrilha?.capa_url) ? `url("${activeCurso?.thumbnail_url || activeTrilha?.capa_url}")` : undefined }}
                >
                  {!(activeCurso?.thumbnail_url || activeTrilha?.capa_url) && 'DOJO TV'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{nomeExibido}</h2>
                  {!editingTrilha && (
                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 mb-2">
                       <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {tempoText}</span>
                       <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Público</span>
                       <span className="flex items-center gap-2"><Award className="w-4 h-4" /> {precoText}</span>
                       <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {ritmoText}</span>
                    </div>
                  )}
                  {editingTrilha && (
                      <div className="flex items-center gap-2 mt-3">
                        {activeTrilha.coordenador_foto_url ? (
                          <img src={activeTrilha.coordenador_foto_url} alt={activeTrilha.coordenador_nome || 'Coordenador'} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                            {(activeTrilha.coordenador_nome || 'C').charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          Coordenador: {activeTrilha.coordenador_nome || 'Sem nome'}
                          {activeTrilha.coordenador_titulo && <span className="text-slate-500 font-normal ml-1">({activeTrilha.coordenador_titulo})</span>}
                        </span>
                      </div>
                  )}
                  {(!editingTrilha && (activeCurso?.professor_nome || activeCurso?.professor_foto_url)) && (
                    <div className="flex items-center gap-2 mt-3">
                      {activeCurso.professor_foto_url ? (
                        <img src={activeCurso.professor_foto_url} alt={activeCurso.professor_nome || 'Professor'} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                          {(activeCurso.professor_nome || 'P').charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700">
                        {activeCurso.professor_nome || 'Professor sem nome'}
                        {activeCurso.professor_titulo && <span className="text-slate-500 font-normal ml-1">({activeCurso.professor_titulo})</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  if (editingTrilha) {
                      alert('Abrir edição de trilha no modal');
                  } else {
                    setEditingSettingsData({
                      nome: activeCurso?.nome || '',
                      thumbnail_url: activeCurso?.thumbnail_url || '',
                      tempo: activeCurso?.tempo || 'sem_limite',
                      duracao: activeCurso?.duracao?.toString() || '',
                      duracao_tipo: activeCurso?.duracao_tipo || 'Dias',
                      ritmo: activeCurso?.ritmo || 'proprio',
                      preco: activeCurso?.preco || 'gratuito',
                      valor: activeCurso?.valor?.toString() || '',
                      professor_nome: activeCurso?.professor_nome || '',
                      professor_titulo: activeCurso?.professor_titulo || '',
                      professor_foto_url: activeCurso?.professor_foto_url || '',
                      descricao: activeCurso?.descricao || '',
                      carga_horaria: activeCurso?.carga_horaria || '',
                      em_breve: activeCurso?.em_breve || false
                    });
                    setIsEditingSettingsModalOpen(true);
                  }
                }}
                className="px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50"
              >
                Editar configurações
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-900">Participantes</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const url = `${window.location.origin}/?inscricao_curso=${createdCourseId}`;
                      navigator.clipboard.writeText(url);
                      alert('Link de inscrição copiado para a área de transferência!');
                    }}
                    className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
                  >
                    <Share2 className="w-4 h-4"/> Compartilhar link de inscrição
                  </button>
                  <button 
                    onClick={() => {
                      setConvidarEmails('');
                      setIsConvidarModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4"/> Convidar participantes
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><Users className="w-4 h-4" /> <span className="text-sm">Total de participantes</span></div>
                  <span className="font-bold text-xl">{courseStats.total}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><BarChart2 className="w-4 h-4" /> <span className="text-sm">Em andamento</span></div>
                  <span className="font-bold text-xl">{courseStats.andamento}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><CheckCircle className="w-4 h-4" /> <span className="text-sm">Concluído</span></div>
                  <span className="font-bold text-xl">{courseStats.concluido}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><Award className="w-4 h-4" /> <span className="text-sm">Taxa de conclusão</span></div>
                  <span className="font-bold text-xl">{courseStats.taxa}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conteudo' && viewConteudo === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-10">
               <h3 className="font-bold text-xl text-slate-900">Conteúdo</h3>
               <button 
                 onClick={() => {
                   setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                   setViewConteudo('edit_section');
                 }}
                 className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-blue-600 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
               >
                 <Plus className="w-4 h-4" /> Adicionar
               </button>
            </div>
            
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
                <h4 className="text-xl font-bold text-slate-900 mb-2">Comece a criar o conteúdo do seu programa</h4>
                <p className="text-slate-600 max-w-lg mb-6">
                  Você pode começar adicionando sua primeira seção manualmente ou deixar que nossa IA gere instantaneamente uma estrutura para você.
                </p>
                <button 
                  onClick={() => {
                    setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                    setViewConteudo('edit_section');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 font-medium hover:underline"
                >
                  <Plus className="w-5 h-5" /> Adicionar seção
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="ROOT" type="SECTION">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                        {sections.map((section, sIdx) => (
                          <Draggable key={section.id || `sec-${sIdx}`} draggableId={section.id || `sec-${sIdx}`} index={sIdx}>
                            {(provided) => (
                              <div 
                                ref={provided.innerRef} 
                                {...provided.draggableProps} 
                                className="border border-slate-200 rounded-lg bg-white shadow-sm"
                              >
                                <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200 group">
                                  <div className="flex items-center gap-3">
                                    <div {...provided.dragHandleProps} className="text-blue-500 font-bold tracking-widest text-lg leading-none cursor-grab opacity-40 group-hover:opacity-100 transition-opacity">
                                      ⋮⋮
                                    </div>
                                    <h4 className="font-bold text-slate-900">{section.nome}</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSection(section);
                                        setViewConteudo('edit_section');
                                      }}
                                      className="text-slate-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                      title="Editar Seção"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const sectionId = section.id;
                                        setModalConfig({
                                          isOpen: true,
                                          type: 'confirm',
                                          title: 'Excluir Seção',
                                          message: `Tem certeza que deseja excluir "${section.nome || 'esta seção'}" e todo o seu conteúdo?`,
                                          onConfirm: () => {
                                            setModalConfig(prev => ({ ...prev, isOpen: false }));
                                            const next = sections.filter((s, idx) => {
                                              if (sectionId) return s.id !== sectionId;
                                              return idx !== sIdx;
                                            });
                                            setSections(next);
                                            saveCurriculo(next);
                                          }
                                        });
                                      }}
                                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                      title="Excluir Seção"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                <div className="bg-slate-50">
                                  <Droppable droppableId={section.id || sIdx.toString()} type="STEP">
                                    {(provided) => (
                                      <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="min-h-[10px]"
                                      >
                            {section.etapas && section.etapas.length > 0 && (
                              <div className="p-4 space-y-2 border-b border-slate-200">
                                {section.etapas.map((etapa: any, eIdx: number) => (
                                  <Draggable key={etapa.id || `${sIdx}-${eIdx}`} draggableId={etapa.id || `${sIdx}-${eIdx}`} index={eIdx}>
                                    {(provided) => (
                                      <div 
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-md"
                                      >
                                        <div {...provided.dragHandleProps} className="cursor-grab text-slate-400 flex items-center justify-center -ml-1 pl-1 pr-2">
                                          ⋮⋮
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 flex-1">{etapa.nome}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">
                                          {etapa.tipo === 'ao_vivo' ? 'Ao vivo' : etapa.tipo}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setEditingStep({ 
                                                id: etapa.id, 
                                                nome: etapa.nome, 
                                                secaoId: section.id, 
                                                tipo: etapa.tipo, 
                                                url_video: etapa.url_video, 
                                                descricao: etapa.descricao,
                                                tempo_video: etapa.tempo_video,
                                                questoes_ids: etapa.questoes_ids || [],
                                                videos: etapa.videos || []
                                              });
                                              setViewConteudo(etapa.tipo === 'quiz' ? 'edit_step_quiz' : (etapa.tipo === 'artigo' ? 'edit_step_artigo' : (etapa.tipo === 'ao_vivo' ? 'edit_step_ao_vivo' : (etapa.tipo === 'multi_video' ? 'edit_step_multi_video' : 'edit_step_video'))));
                                            }}
                                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                            title="Editar"
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const etapaId = etapa.id;
                                              setModalConfig({
                                                isOpen: true,
                                                type: 'confirm',
                                                title: 'Excluir Etapa',
                                                message: `Tem certeza que deseja excluir "${etapa.nome || 'esta etapa'}"?`,
                                                onConfirm: () => {
                                                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                                                  const next = sections.map((sec, currSIdx) => {
                                                    if (currSIdx === sIdx) {
                                                      return {
                                                        ...sec,
                                                        etapas: (sec.etapas || []).filter((etap: any, idx: number) => {
                                                          if (etapaId) return etap.id !== etapaId;
                                                          return idx !== eIdx;
                                                        })
                                                      };
                                                    }
                                                    return sec;
                                                  });
                                                  setSections(next);
                                                  saveCurriculo(next);
                                                }
                                              });
                                            }}
                                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                            {(!section.etapas || section.etapas.length === 0) && (
                              <div className="p-4 border-b border-slate-200" style={{minHeight: "10px"}}>
                                {provided.placeholder}
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                      
                      <div className="p-4 bg-slate-100 flex gap-6 text-sm font-medium text-blue-600 relative rounded-b-lg">
                        <div>
                          <button 
                            onClick={() => {
                              const sid = section.id || `sec-${sIdx}`;
                              setAddingStepToSection(addingStepToSection === sid ? null : sid);
                            }}
                            className="flex items-center gap-1 hover:underline text-blue-500"
                          >
                            <Plus className="w-4 h-4"/> Adicionar etapa
                          </button>
                          {addingStepToSection === (section.id || `sec-${sIdx}`) && (
                            <div className="absolute top-full left-4 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-20">
                               <button onClick={() => {
                                 const sid = section.id || `sec-${sIdx}`;
                                 setEditingStep({ nome: '', secaoId: sid, tipo: 'artigo', descricao: '' });
                                 setViewConteudo('edit_step_artigo');
                                 setAddingStepToSection(null);
                               }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-slate-400"/> Artigo</button>
                               <button onClick={() => {
                                 const sid = section.id || `sec-${sIdx}`;
                                 setEditingStep({ nome: '', secaoId: sid, tipo: 'video', descricao: '', url_video: '', tempo_video: '' });
                                 setViewConteudo('edit_step_video');
                                 setAddingStepToSection(null);
                               }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><PlayCircle className="w-4 h-4 text-slate-400"/> Vídeo</button>
                               <button onClick={() => {
                                 const sid = section.id || `sec-${sIdx}`;
                                 setEditingStep({ nome: '', secaoId: sid, tipo: 'multi_video', videos: [{title: '', url: ''}] });
                                 setViewConteudo('edit_step_multi_video');
                                 setAddingStepToSection(null);
                               }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><List className="w-4 h-4 text-slate-400"/> Multi-vídeo</button>
                               <button onClick={() => {
                                 const sid = section.id || `sec-${sIdx}`;
                                 setEditingStep({ nome: '', secaoId: sid, tipo: 'ao_vivo', descricao: '', url_video: '', tempo_video: '' });
                                 setViewConteudo('edit_step_ao_vivo');
                                 setAddingStepToSection(null);
                               }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><VideoIcon className="w-4 h-4 text-slate-400"/> Ao Vivo</button>
                               <button onClick={() => {
                                 const sid = section.id || `sec-${sIdx}`;
                                 setEditingStep({ nome: '', secaoId: sid, tipo: 'quiz', questoes_ids: [] });
                                 setViewConteudo('edit_step_quiz');
                                 setAddingStepToSection(null);
                               }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><CheckCircle className="w-4 h-4 text-slate-400"/> Quiz</button>
                            </div>
                          )}
                        </div>
                        <button className="flex items-center gap-1 hover:underline text-blue-500"><Download className="w-4 h-4"/> Importar etapa</button>
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>

                <button 
                  onClick={() => {
                    setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                    setViewConteudo('edit_section');
                  }}
                  className="flex items-center gap-2 text-blue-500 font-medium py-4 px-2 hover:underline"
                >
                  <Plus className="w-4 h-4" /> Seções
                </button>
              </div>
            )}
          </div>
        )}

        {viewConteudo === 'edit_section' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 sticky top-0">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingSection.nome || 'Nome da seção'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingSection.nome.trim() === ''}
                   onClick={() => {
                     if (editingSection.id) {
                       const newSecs = sections.map(s => s.id === editingSection.id ? { ...s, ...editingSection } : s);
                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     } else {
                       const newSecs = [...sections, { id: Date.now().toString(), ...editingSection, etapas: [] }];
                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingSection.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">Informações</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <label>Nome da seção</label>
                      <span>{editingSection.nome.length}/50</span>
                    </div>
                    <input 
                      type="text" 
                      value={editingSection.nome}
                      onChange={(e) => setEditingSection({...editingSection, nome: e.target.value.substring(0, 50)})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      placeholder="Nome da seção"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Seção progressiva</h3>
                    <button 
                      onClick={() => setEditingSection({...editingSection, progressiva: !editingSection.progressiva})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingSection.progressiva ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${editingSection.progressiva ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {editingSection.progressiva ? (
                      <>
                        <div>
                          <label className="block text-sm text-slate-600 mb-2">Selecionar dia <span className="text-blue-500">*</span></label>
                          <div className="flex gap-2">
                             <select 
                               value={editingSection.semana}
                               onChange={(e) => setEditingSection({...editingSection, semana: e.target.value})}
                               className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 text-slate-700 text-sm"
                             >
                                <option>Semana 1</option>
                                <option>Semana 2</option>
                                <option>Semana 3</option>
                             </select>
                             <select 
                               value={editingSection.dia}
                               onChange={(e) => setEditingSection({...editingSection, dia: e.target.value})}
                               className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 text-slate-700 text-sm"
                             >
                                <option>Dia 1</option>
                                <option>Dia 2</option>
                                <option>Dia 3</option>
                                <option>Dia 4</option>
                                <option>Dia 5</option>
                                <option>Dia 6</option>
                                <option>Dia 7</option>
                             </select>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          Permita que os participantes concluam esta seção em um dia específico após entrarem no programa.
                        </p>
                      </>
                    ) : (
                      <p className="text-slate-600 text-sm leading-relaxed">
                        Permita que os participantes concluam esta seção em um dia específico após entrarem no programa.
                      </p>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

         {viewConteudo === 'edit_step_video' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === ''}
                   onClick={() => {
                     // Save step logic
                     const newSecs = [...sections];
                     const sectionIdx = newSecs.findIndex(s => s.id === editingStep.secaoId);
                     if (sectionIdx !== -1) {
                       const stepId = editingStep.id || Date.now().toString();
                       
                       // Remove from old section if moved
                       newSecs.forEach((sec) => {
                         if (sec.etapas) {
                           sec.etapas = sec.etapas.filter((e: any) => e.id !== stepId);
                         }
                       });

                       // Add/replace in new section
                       const newEtapas = [...(newSecs[sectionIdx].etapas || [])];
                       newEtapas.push({ id: stepId, nome: editingStep.nome, tipo: editingStep.tipo, url_video: editingStep.url_video, descricao: editingStep.descricao, tempo_video: editingStep.tempo_video });
                       newSecs[sectionIdx].etapas = newEtapas;
                       
                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingStep.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Video URL */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Vídeo</h3>
                    </div>
                    <div className="p-5">
                      <div className="border border-dashed border-blue-400 bg-blue-50/10 rounded-lg p-12 flex flex-col items-center justify-center">
                         <div className="text-center w-full max-w-md space-y-4">
                           <div className="mx-auto w-10 h-10 text-blue-500 flex items-center justify-center mb-2">
                             <Plus className="w-8 h-8 font-light" />
                           </div>
                           <input 
                             type="text" 
                             placeholder="Cole a URL do YouTube" 
                             value={editingStep.url_video || ''}
                             onChange={(e) => setEditingStep({...editingStep, url_video: e.target.value})}
                             className="w-full px-4 py-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                           />
                           {editingStep.url_video && (editingStep.url_video.includes('youtube.com') || editingStep.url_video.includes('youtu.be')) && (
                             <div className="aspect-video w-full mt-4 bg-slate-900 rounded overflow-hidden">
                               <iframe 
                                 src={getFormattedVideoUrl(editingStep.url_video)} 
                                 className="w-full h-full border-0"
                                 allowFullScreen
                               ></iframe>
                             </div>
                           )}
                           <div className="mt-4">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Duração do Vídeo</label>
                             <input 
                               type="text" 
                               placeholder="Ex. 03:45" 
                               value={editingStep.tempo_video || ''}
                               onChange={(e) => setEditingStep({...editingStep, tempo_video: e.target.value})}
                               className="w-full px-4 py-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                             />
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Descrição</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Settings Sidebar */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 text-sm">Visão geral das configurações</h3>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Assistir vídeo (obrigatório)</span>
                        <span className="text-slate-400">{videoSettings.assistirObrigatorio ? 'Ativado' : 'Desativado'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Reprodução automática</span>
                        <span className="text-slate-400">{videoSettings.reproduzirAutomaticamente ? 'Ativado' : 'Desativado'}</span>
                      </div>
                      <button 
                        onClick={() => setIsVideoSettingsModalOpen(true)}
                        className="text-blue-600 font-medium flex items-center gap-2 hover:underline text-sm pt-2"
                      >
                        <Settings className="w-3.5 h-3.5" /> Editar configurações
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
         )}

         {viewConteudo === 'edit_step_multi_video' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Novo Multi-vídeo'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === ''}
                   onClick={() => {
                     const newSecs = [...sections];
                     const sectionIdx = newSecs.findIndex(s => s.id === editingStep.secaoId);
                     if (sectionIdx !== -1) {
                       const stepId = editingStep.id || Date.now().toString();
                       
                       newSecs.forEach((sec) => {
                         if (sec.etapas) {
                           sec.etapas = sec.etapas.filter((e: any) => e.id !== stepId);
                         }
                       });

                       const newEtapas = [...(newSecs[sectionIdx].etapas || [])];
                       newEtapas.push({ 
                         id: stepId, 
                         nome: editingStep.nome, 
                         tipo: editingStep.tipo, 
                         descricao: editingStep.descricao,
                         videos: editingStep.videos 
                       });
                       newSecs[sectionIdx].etapas = newEtapas;
                       
                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingStep.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900">Informações básicas</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-slate-600 mb-1">
                        <label>Nome da etapa <span className="text-blue-600">*</span></label>
                        <span>{editingStep.nome.length}/60</span>
                      </div>
                      <input 
                        type="text" 
                        value={editingStep.nome}
                        onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        placeholder="Nomeie sua etapa (ex: Coletânea de Técnicas)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                      <select 
                        value={editingStep.secaoId}
                        onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                      >
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Lista de Vídeos</h3>
                    <button 
                      onClick={() => setEditingStep({
                        ...editingStep, 
                        videos: [...(editingStep.videos || []), {title: '', url: ''}]
                      })}
                      className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-4 h-4"/> Adicionar vídeo
                    </button>
                  </div>
                  <div className="p-5 space-y-6">
                    {editingStep.videos?.map((video, idx) => (
                      <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative group">
                        <button 
                          onClick={() => {
                            const newVideos = [...(editingStep.videos || [])];
                            newVideos.splice(idx, 1);
                            setEditingStep({...editingStep, videos: newVideos});
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Título do Vídeo</label>
                            <input 
                              type="text"
                              value={video.title}
                              onChange={(e) => {
                                const newVideos = [...(editingStep.videos || [])];
                                newVideos[idx].title = e.target.value;
                                setEditingStep({...editingStep, videos: newVideos});
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 text-sm"
                              placeholder="Ex: Waza-ari Tutorial"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">URL do YouTube</label>
                            <input 
                              type="text"
                              value={video.url}
                              onChange={(e) => {
                                const newVideos = [...(editingStep.videos || [])];
                                newVideos[idx].url = e.target.value;
                                setEditingStep({...editingStep, videos: newVideos});
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 text-sm"
                              placeholder="https://www.youtube.com/watch?v=..."
                            />
                          </div>
                        </div>
                        {video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be')) && (
                          <div className="mt-4 aspect-video w-full max-w-sm mx-auto rounded overflow-hidden shadow-inner bg-black">
                            <iframe 
                               src={getFormattedVideoUrl(video.url)} 
                               className="w-full h-full border-0"
                               allowFullScreen
                             ></iframe>
                          </div>
                        )}
                      </div>
                    ))}

                    {(!editingStep.videos || editingStep.videos.length === 0) && (
                      <div className="text-center py-8 text-slate-500 italic border border-dashed border-slate-200 rounded-lg">
                        Nenhum vídeo adicionado. Clique em "Adicionar vídeo" para começar.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900">Descrição (Opcional)</h3>
                  </div>
                  <div className="p-5">
                    <textarea 
                      value={editingStep.descricao || ''}
                      onChange={(e) => setEditingStep({...editingStep, descricao: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 min-h-[150px] resize-y"
                      placeholder="Adicione instruções ou informações extras sobre esta coleção de vídeos..."
                    />
                  </div>
                </div>
             </div>
          </div>
         )}

         {viewConteudo === 'edit_step_ao_vivo' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === ''}
                   onClick={() => {
                     // Save step logic
                     const newSecs = [...sections];
                     const sectionIdx = newSecs.findIndex(s => s.id === editingStep.secaoId);
                     if (sectionIdx !== -1) {
                       const stepId = editingStep.id || Date.now().toString();
                       
                       // Remove from old section if moved
                       newSecs.forEach((sec) => {
                         if (sec.etapas) {
                           sec.etapas = sec.etapas.filter((e: any) => e.id !== stepId);
                         }
                       });

                       // Add/replace in new section
                       const newEtapas = [...(newSecs[sectionIdx].etapas || [])];
                       newEtapas.push({ id: stepId, nome: editingStep.nome, tipo: editingStep.tipo, url_video: editingStep.url_video, descricao: editingStep.descricao, tempo_video: editingStep.tempo_video });
                       newSecs[sectionIdx].etapas = newEtapas;
                       
                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingStep.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa (Ex: Aula Inaugural Ao Vivo)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Live URL */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Transmissão (YouTube Live)</h3>
                    </div>
                    <div className="p-5">
                      <div className="border border-dashed border-red-400 bg-red-50/10 rounded-lg p-12 flex flex-col items-center justify-center">
                         <div className="text-center w-full max-w-md space-y-4">
                           <div className="mx-auto w-10 h-10 text-red-500 flex items-center justify-center mb-2">
                             <VideoIcon className="w-8 h-8 font-light" />
                           </div>
                           <input 
                             type="text" 
                             placeholder="Cole a URL do YouTube Live" 
                             value={editingStep.url_video || ''}
                             onChange={(e) => setEditingStep({...editingStep, url_video: e.target.value})}
                             className="w-full px-4 py-2 border border-slate-300 rounded focus:border-red-500 outline-none"
                           />
                           {editingStep.url_video && (editingStep.url_video.includes('youtube.com') || editingStep.url_video.includes('youtu.be')) && (
                             <div className="aspect-video w-full mt-4 bg-slate-900 rounded overflow-hidden">
                               <iframe 
                                 src={getFormattedVideoUrl(editingStep.url_video)} 
                                 className="w-full h-full border-0"
                                 allowFullScreen
                               ></iframe>
                             </div>
                           )}
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Descrição e Instruções</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Settings Sidebar */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 text-sm">Configurações da Live</h3>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <p className="text-slate-500">Ao usar o modo Ao Vivo, os participantes terão acesso a um chat em tempo real e um botão para confirmar participação na própria tela de transmissão.</p>
                    </div>
                  </div>

                  {/* Admin Live Chat */}
                  {editingStep.id && (
                    <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm" style={{ minHeight: '400px' }}>
                      <div className="bg-white border-b border-slate-200 p-4">
                         <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600"/> Chat ao vivo</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px]">
                         <div className="text-center text-xs text-slate-400 my-4">Chat vinculado à etapa salva.</div>
                         {chatMessages.map(msg => (
                           <div key={msg.id} className="text-sm">
                             <span className="font-bold text-slate-700 mr-2">{msg.user_name}:</span>
                             <span className="text-slate-600">{msg.text}</span>
                           </div>
                         ))}
                      </div>
                      <div className="bg-slate-50 border-t border-slate-200 p-3">
                         <div className="flex gap-2 relative">
                            <input 
                              type="text" 
                              placeholder="Falar como Professor..." 
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && sendLiveMessage()}
                              className="w-full px-4 py-2 bg-white border-slate-300 rounded-full text-sm outline-none focus:border-blue-500 border transition-colors pr-16" 
                            />
                            <button 
                              onClick={sendLiveMessage}
                              disabled={!chatInput.trim()}
                              className="absolute right-1.5 top-1.5 w-auto px-3 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
                         </div>
                      </div>
                    </div>
                  )}
                  {!editingStep.id && (
                     <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                       <span className="font-bold">Chat indisponível:</span> Salve a etapa primeiro para habilitar o chat ao vivo interativo.
                     </div>
                  )}
                </div>
             </div>
          </div>
         )}

          {viewConteudo === 'edit_step_quiz' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === ''}
                   onClick={() => {
                     const newSecs = [...sections];
                     const sectionIdx = newSecs.findIndex(s => s.id === editingStep.secaoId);
                     if (sectionIdx !== -1) {
                       const stepId = editingStep.id || Date.now().toString();
                       
                       // Remove from old section if moved
                       newSecs.forEach((sec) => {
                         if (sec.etapas) {
                           sec.etapas = sec.etapas.filter((e: any) => e.id !== stepId);
                         }
                       });

                       // Add/replace in new section
                       const newEtapas = [...(newSecs[sectionIdx].etapas || [])];
                       newEtapas.push({ id: stepId, nome: editingStep.nome, tipo: editingStep.tipo, questoes_ids: editingStep.questoes_ids || [] });
                       newSecs[sectionIdx].etapas = newEtapas;

                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingStep.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Configuração do Quiz</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome do quiz <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Ex: Avaliação Módulo 1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Questões */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">Questões do Quiz ({(editingStep.questoes_ids || []).length})</h3>
                      <button 
                        onClick={() => setIsSelectQuestionsModalOpen(true)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4"/> Selecionar Questões
                      </button>
                    </div>
                    <div className="p-5">
                      {(editingStep.questoes_ids || []).length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p>Nenhuma questão foi adicionada a este quiz ainda.</p>
                          <p className="text-sm mt-1">Clique no botão acima para selecionar questões do banco.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(editingStep.questoes_ids || []).map((qId, idx) => {
                            const qInfo = availableQuestions.find(q => q.id === qId);
                            return (
                              <div key={qId} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-400 min-w-[24px]">{idx + 1}.</span>
                                  <div>
                                    <p className="text-slate-800 font-medium line-clamp-1">{qInfo?.texto || 'Questão não encontrada'}</p>
                                    <p className="text-xs text-slate-500 mt-1 capitalize">Nível: {qInfo?.nivel || 'N/A'}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setEditingStep({
                                      ...editingStep,
                                      questoes_ids: (editingStep.questoes_ids || []).filter(id => id !== qId)
                                    })
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
             </div>
          </div>
         )}

        {viewConteudo === 'edit_step_artigo' && (
          <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === ''}
                   onClick={() => {
                     const newSecs = [...sections];
                     const sectionIdx = newSecs.findIndex(s => s.id === editingStep.secaoId);
                     if (sectionIdx !== -1) {
                       const stepId = editingStep.id || Date.now().toString();
                       
                       // Remove from old section if moved
                       newSecs.forEach((sec) => {
                         if (sec.etapas) {
                           sec.etapas = sec.etapas.filter((e: any) => e.id !== stepId);
                         }
                       });

                       // Add/replace in new section
                       const newEtapas = [...(newSecs[sectionIdx].etapas || [])];
                       newEtapas.push({ id: stepId, nome: editingStep.nome, tipo: editingStep.tipo, descricao: editingStep.descricao });
                       newSecs[sectionIdx].etapas = newEtapas;

                       setSections(newSecs);
                       saveCurriculo(newSecs);
                     }
                     setViewConteudo('list');
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-colors ${editingStep.nome.trim() === '' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                 >
                   Salvar
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Conteúdo</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
             </div>
          </div>
         )}

        {activeTab === 'participantes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-900">{courseStats.total === 0 ? 6 : courseStats.total} participantes ativos</h3>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">
                  <Download className="w-4 h-4"/> Exportar CSV
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">
                  <Filter className="w-4 h-4"/> Adicionar filtro
                </button>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search" className="pl-9 pr-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f2f6fe] text-slate-700 border-b border-blue-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nome</th>
                    <th className="px-6 py-4 font-semibold">Desempenho <span className="text-blue-600">↓</span></th>
                    <th className="px-6 py-4 font-semibold">Última atividade</th>
                    <th className="px-6 py-4 font-semibold">Data de entrada</th>
                    <th className="px-6 py-4 font-semibold">Preço</th>
                    <th className="px-6 py-4 font-semibold">Certificado</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(courseParticipants.length > 0 ? courseParticipants.map(participant => {
                      const getInitials = (name?: string) => name ? name.substring(0, 2).toUpperCase() : '??';
                      const cappedProgress = Math.min(100, Math.max(0, participant.progresso || 0));
                      const isNew = cappedProgress === 0;
                      const isFinished = cappedProgress >= 100;
                      let totalQuizPercentage = 0;
                      let numQuizzes = 0;
                      if (participant.quiz_scores) {
                        Object.values(participant.quiz_scores).forEach((score: any) => {
                          if (score.total && score.total > 0) {
                            totalQuizPercentage += ((score.correct || 0) / score.total) * 100;
                            numQuizzes++;
                          }
                        });
                      }
                      const hasQuiz = numQuizzes > 0;
                      const quizGrade = hasQuiz ? Math.round(totalQuizPercentage / numQuizzes) : null;

                      let bgColor = 'bg-slate-200';
                      let txColor = 'text-slate-700';
                      let statusText = 'Baixo';
                      if (cappedProgress >= 90) { bgColor = 'bg-emerald-100'; txColor = 'text-emerald-700'; statusText = 'Excepcional'; }
                      else if (cappedProgress >= 50) { bgColor = 'bg-yellow-100'; txColor = 'text-yellow-700'; statusText = 'Alto'; }
                      else if (cappedProgress > 0) { bgColor = 'bg-amber-100'; txColor = 'text-amber-700'; statusText = 'Baixo'; }
                      else { bgColor = 'bg-slate-400'; txColor = 'text-white'; statusText = 'Baixo'; }

                      return {
                          nome: participant.usuarios?.nome || participant.usuarios?.email || 'Usuário Desconhecido',
                          initials: getInitials(participant.usuarios?.nome || participant.usuarios?.email),
                          rate: `${cappedProgress}%`,
                          status: statusText,
                          quizGrade,
                          date1: new Date(participant.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                          date2: new Date(participant.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                          bgColor,
                          txColor,
                          isNew,
                          isFinished
                      };
                  }) : [
                    { nome: 'Ademilson Alves', initials: 'AA', rate: '92%', status: 'Excepcional', date1: '23 de abr de 2026', date2: '16 de abr de 2026', bgColor: 'bg-emerald-100', txColor: 'text-emerald-700', quizGrade: null },
                    { nome: 'Breno Maia', initials: 'BM', rate: '52%', status: 'Alto', date1: '13 de abr de 2026', date2: '13 de abr de 2026', bgColor: 'bg-yellow-100', txColor: 'text-yellow-700', quizGrade: null },
                    { nome: 'Bruno Maia', initials: 'BM', rate: '8%', status: 'Baixo', date1: '30 de abr de 2026', date2: '13 de abr de 2026', bgColor: 'bg-amber-100', txColor: 'text-amber-700', quizGrade: null },
                    { nome: 'Rafael Mendes', initials: 'RM', rate: '8%', status: 'Baixo', date1: '17 de abr de 2026', date2: '17 de abr de 2026', bgColor: 'bg-slate-200', txColor: 'text-slate-700', quizGrade: null },
                    { nome: 'artur magnavita', initials: 'AM', rate: '4%', status: 'Baixo', date1: '16 de abr de 2026', date2: '16 de abr de 2026', bgColor: 'bg-slate-800', txColor: 'text-white', quizGrade: null },
                    { nome: 'Mariana Rêgo', initials: 'MR', rate: '0%', status: 'Baixo', date1: '30 de abr de 2026', date2: '30 de abr de 2026', bgColor: 'bg-slate-400', txColor: 'text-white', isNew: true, quizGrade: null },
                  ]).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${p.bgColor} ${p.txColor}`}>{p.initials}</div>
                           <div>
                             <div className="font-medium text-slate-900">{p.nome}</div>
                             <div className={`text-[10px] uppercase font-semibold mt-0.5 px-2 py-0.5 inline-block rounded ${p.isNew ? 'bg-rose-100 text-rose-700' : p.isFinished ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>
                               {p.isNew ? 'Não começou' : p.isFinished ? 'Concluído' : 'Em Andamento'}
                             </div>
                           </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{p.rate}</div>
                        <div className="text-xs text-slate-500">{p.status}</div>
                        {p.quizGrade !== null && (
                          <div className="text-xs font-semibold text-blue-600 mt-0.5">Nota: {p.quizGrade}%</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{p.date1}</td>
                      <td className="px-6 py-4 text-slate-600">{p.date2}</td>
                      <td className="px-6 py-4 text-slate-600">Gratuito</td>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {p.isFinished ? (
                          <span className="text-emerald-600">Concluído</span>
                        ) : (
                          <>Não<br/>emitido</>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            {p.isFinished && (
                               <button 
                                 onClick={() => {
                                   const participant = courseParticipants[i];
                                   if (participant) handleDownloadParticipantCertificate(participant);
                                 }}
                                 className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                 title="Baixar Certificado"
                               >
                                 <Download className="w-5 h-5" />
                               </button>
                            )}
                            <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full">
                              <MoreHorizontal className="w-5 h-5"/>
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Informações básicas</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Nome e descrição</div>
                <div className="flex items-center gap-4 text-slate-600">
                  <span>{createdCourseName}</span>
                  <span className="w-px h-4 bg-slate-300"></span>
                  <span className="truncate">Domine o DOJO TV e transforme a dinâmica das suas aulas. Neste tutorial passo a passo, você aprenderá...</span>
                </div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Categorias</div>
                <div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Tutorial de Aplicativos</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Programação</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Ritmo</div>
                <div className="text-slate-600">No seu próprio ritmo</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Limite de tempo</div>
                <div className="text-slate-600">Sem limite</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Inscrição e pagamento</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Opções de preço</div>
                <div className="text-slate-600">Gratuito</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Visibilidade</div>
                <div className="text-slate-600">Público</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Limite de participação</div>
                <div className="text-slate-600">Ilimitado</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Configurações de conteúdo</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Acesso à etapa</div>
                <div className="text-slate-600">Qualquer ordem</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Necessário assistir a vídeos</div>
                <div className="text-slate-400">Desativado</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Reprodução automática da próxima etapa de vídeo</div>
                <div className="text-slate-400">Desativado</div>
              </div>
            </div>

             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Instrutores</h3>
                  <p className="text-sm text-slate-500">Atribua instrutores a este programa e edite seus perfis.</p>
                </div>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Gerenciar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm font-medium border-t border-slate-50 pt-6">
                <div className="font-semibold text-slate-700 uppercase tracking-wider text-xs">Instrutores atribuídos</div>
                <div className="flex flex-col gap-4">
                  {editingTrilha ? (
                    (() => {
                      const extra = activeTrilha?.professores_extra_json || [];
                      const guestRows = Array.isArray(extra) && extra.length > 0 
                        ? extra.map((p: any, idx: number) => (
                          <div key={`guest-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                             <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                               {p.nome.charAt(0)}
                             </div>
                             <div>
                               <div className="font-bold text-slate-900">{p.nome}</div>
                               <div className="text-xs text-slate-500">{p.titulo}</div>
                             </div>
                          </div>
                        ))
                        : activeTrilha?.professores_convidados 
                          ? [<div key="old-guest" className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                {activeTrilha.professores_convidados.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{activeTrilha.professores_convidados}</div>
                                <div className="text-xs text-slate-500">{activeTrilha.professores_titulos}</div>
                              </div>
                             </div>]
                          : [];
                      
                      return guestRows.length > 0 ? guestRows : <div className="text-slate-400 italic">Sem professores convidados.</div>;
                    })()
                  ) : activeCurso?.professor_nome || activeCurso?.professor_foto_url ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                       {activeCurso.professor_foto_url ? (
                         <img src={activeCurso.professor_foto_url} alt={activeCurso.professor_nome || 'Instrutor'} className="w-12 h-12 rounded-full object-cover border border-white shadow-sm" />
                       ) : (
                         <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                           {(activeCurso.professor_nome || 'I').charAt(0)}
                         </div>
                       )}
                       <div>
                         <div className="font-bold text-slate-900">{activeCurso.professor_nome || 'Instrutor principal'}</div>
                         <div className="text-xs text-slate-500">{activeCurso.professor_titulo || 'Especialista'}</div>
                       </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">Sem instrutores configurados. Vá em configurações para adicionar.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'acessar_curso' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <CursosCandidato previewCourseId={createdCourseId || undefined} isGestor={true} />
          </div>
        )}

        {activeTab === 'engajamento' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex gap-6 items-start pb-6 border-b border-slate-100">
                <div className="w-24 h-24 bg-rose-900 rounded-lg flex items-center justify-center text-white">
                  <MessageSquare className="w-10 h-10" />
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">Comunidade e comunicação</h3>
                  <p className="text-sm text-slate-600">Crie conexões por colaboração e engajamento em tempo real.</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                 <span className="font-semibold text-slate-700">Grupo</span>
                 <div className="flex items-center gap-6">
                   <span className="text-slate-400">Não conectado</span>
                   <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50">Conectar grupo</button>
                 </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex gap-6 items-start pb-6 border-b border-slate-100">
                <div className="w-24 h-24 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Award className="w-10 h-10" />
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">Recompensas</h3>
                  <p className="text-sm text-slate-600">Comemore o sucesso com certificados e selos de desempenho.</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm py-4 border-b border-slate-100">
                 <span className="font-semibold text-slate-700">Certificado</span>
                 <div className="flex items-center justify-between flex-1 ml-16">
                   <div className="flex flex-col">
                     <span className="text-slate-400">Não conectado</span>
                     <span className="text-slate-600">Crie e emita um certificado de conclusão para os participantes que concluírem este programa.</span>
                   </div>
                   <button 
                     onClick={() => {
                        setEditingCertTemplate(activeCurso?.certificado_template || null);
                        setIsCertificateModalOpen(true);
                     }}
                     className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50 whitespace-nowrap"
                   >
                     {activeCurso?.certificado_template ? 'Editar certificado' : 'Criar certificado'}
                   </button>
                 </div>
              </div>
               <div className="flex items-center justify-between text-sm pt-4">
                 <span className="font-semibold text-slate-700">Selos</span>
                 <div className="flex items-center justify-between flex-1 ml-16">
                   <div className="flex flex-col">
                     <span className="text-slate-400">Não adicionado</span>
                     <span className="text-slate-600">Dê aos participantes um selo quando concluírem todas as etapas.</span>
                   </div>
                   <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50 whitespace-nowrap">Adicionar selos</button>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditingSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Editar Configurações</h2>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Curso <span className="text-blue-600">*</span></label>
                <input 
                  type="text" 
                  value={editingSettingsData.nome}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, nome: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                />
              </div>

              {/* Descricao */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Curso</label>
                <textarea 
                  value={editingSettingsData.descricao}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, descricao: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 resize-none h-24"
                />
              </div>

              {/* Carga Horaria */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Carga Horária</label>
                <input 
                  type="text" 
                  value={editingSettingsData.carga_horaria}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, carga_horaria: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                />
              </div>

              {/* URL da Capa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem de Capa</label>
                <input 
                  type="text" 
                  value={editingSettingsData.thumbnail_url}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, thumbnail_url: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                  placeholder="https://..."
                />
              </div>

              {/* Professor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_nome}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_nome: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_titulo}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_titulo: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="Ex. Faixa Preta"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL da Foto do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_foto_url}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_foto_url: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Ritmo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ritmo</label>
                  <select 
                    value={editingSettingsData.ritmo}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, ritmo: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="proprio">No seu próprio ritmo</option>
                    <option value="programado">Programado</option>
                  </select>
                </div>

                {/* Preço */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custo</label>
                  <select 
                    value={editingSettingsData.preco}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, preco: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              {/* Valor */}
              {editingSettingsData.preco === 'pago' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Curso (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingSettingsData.valor}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, valor: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Em Breve */}
              <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <input 
                  type="checkbox" 
                  id="editEmBreve" 
                  checked={editingSettingsData.em_breve} 
                  onChange={e => setEditingSettingsData({...editingSettingsData, em_breve: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="editEmBreve" className="font-bold text-slate-800">Marcar como "Em Breve"</label>
                <span className="text-xs text-slate-500 ml-auto">(Exibe selo verde no lugar do preço)</span>
              </div>

              {/* Tempo / Formato */}
              <div className="border border-slate-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">Duração do Programa</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tempo_edit"
                      checked={editingSettingsData.tempo === 'sem_limite'}
                      onChange={() => setEditingSettingsData({...editingSettingsData, tempo: 'sem_limite'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">Sem limite de tempo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tempo_edit"
                      checked={editingSettingsData.tempo === 'com_limite'}
                      onChange={() => setEditingSettingsData({...editingSettingsData, tempo: 'com_limite'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">Com limite de tempo</span>
                  </label>
                </div>
                
                {editingSettingsData.tempo === 'com_limite' && (
                  <div className="mt-4 flex gap-4">
                    <div className="flex-1">
                      <input 
                        type="number" 
                        value={editingSettingsData.duracao}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, duracao: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="flex-1">
                      <select 
                        value={editingSettingsData.duracao_tipo}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, duracao_tipo: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="Dias">Dias</option>
                        <option value="Semanas">Semanas</option>
                        <option value="Meses">Meses</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsEditingSettingsModalOpen(false)}
                className="px-6 py-2 border border-slate-300 rounded-full font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                disabled={isSaving || !editingSettingsData.nome.trim()}
                onClick={async () => {
                  if (!createdCourseId) return;
                  setIsSaving(true);
                  try {
                    const updateData: any = {
                      nome: editingSettingsData.nome,
                      descricao: editingSettingsData.descricao,
                      tempo: editingSettingsData.tempo,
                      duracao: editingSettingsData.duracao ? parseInt(editingSettingsData.duracao, 10) : null,
                      duracao_tipo: editingSettingsData.duracao_tipo,
                      ritmo: editingSettingsData.ritmo,
                      preco: editingSettingsData.preco,
                      valor: editingSettingsData.preco === 'pago' && editingSettingsData.valor ? parseFloat(editingSettingsData.valor) : null,
                      professor_nome: editingSettingsData.professor_nome,
                      professor_titulo: editingSettingsData.professor_titulo,
                      professor_foto_url: editingSettingsData.professor_foto_url,
                      carga_horaria: editingSettingsData.carga_horaria,
                      em_breve: editingSettingsData.em_breve
                    };

                    // Try updating everything including thumbnail_url
                    try {
                      const completeData = { ...updateData, thumbnail_url: editingSettingsData.thumbnail_url };
                      const { error } = await supabase.from('cursos').update(completeData).eq('id', createdCourseId);
                      if (error) throw error;
                      
                      setCreatedCourseName(editingSettingsData.nome);
                      setIsEditingSettingsModalOpen(false);
                      fetchCursos();
                    } catch (err: any) {
                      console.error('Error updating course settings:', err);
                      if (err.message && (err.message.includes("does not exist") || err.code === 'PGRST204' || err.message.includes("Could not find the"))) {
                        alert(`Erro no banco de dados: ${err.message}\n\nExecute no SQL Editor para adicionar a coluna faltante:\n\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS thumbnail_url text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_nome text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_titulo text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_foto_url text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS descricao text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS carga_horaria text;\nNOTIFY pgrst, 'reload schema';`);
                      } else {
                        alert('Erro ao atualizar. Tente novamente.');
                        throw err;
                      }
                    }
                  } catch (err) {
                    console.error('Error updating course settings:', err);
                    alert('Erro ao atualizar. Tente novamente.');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className={`px-8 py-2 rounded-full font-medium text-white transition-colors flex items-center gap-2 ${
                  isSaving || !editingSettingsData.nome.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</> : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isVideoSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 pb-2 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Configurações de vídeo</h2>
                <p className="text-slate-500 text-sm">Essas configurações serão aplicadas a todas as etapas de vídeo do seu programa.</p>
              </div>
              <button onClick={() => setIsVideoSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              <div className="flex gap-4">
                <div className="pt-1">
                  <button 
                    onClick={() => setVideoSettings(prev => ({ ...prev, assistirObrigatorio: !prev.assistirObrigatorio }))}
                    className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${videoSettings.assistirObrigatorio ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform flex items-center justify-center ${videoSettings.assistirObrigatorio ? 'translate-x-5' : 'translate-x-0'}`}>
                      {videoSettings.assistirObrigatorio && <Check className="w-3 h-3 text-blue-600" />}
                    </div>
                  </button>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Assistir vídeos é obrigatório</h3>
                  <p className="text-slate-500 text-sm mb-4">Defina a porcentagem que os participantes devem assistir para concluir a etapa.</p>
                  
                  {videoSettings.assistirObrigatorio && (
                    <div className="flex items-center gap-2 max-w-[120px]">
                      <div className="relative flex-1">
                        <input 
                          type="number"
                          min="1"
                          max="100"
                          value={videoSettings.porcentagem}
                          onChange={(e) => setVideoSettings(prev => ({ ...prev, porcentagem: parseInt(e.target.value) || 0 }))}
                          className="w-full pl-4 pr-8 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="absolute right-3 top-2.5 text-slate-400 font-medium select-none">%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div className="flex gap-4">
                <div className="pt-1">
                  <button 
                    onClick={() => setVideoSettings(prev => ({ ...prev, reproduzirAutomaticamente: !prev.reproduzirAutomaticamente }))}
                    className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${videoSettings.reproduzirAutomaticamente ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${videoSettings.reproduzirAutomaticamente ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Reproduzir próxima etapa de vídeo automaticamente</h3>
                  <p className="text-slate-500 text-sm">Quando uma etapa de vídeo termina, a próxima começa automaticamente.</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 flex justify-end gap-3">
              <button 
                onClick={() => setIsVideoSettingsModalOpen(false)}
                className="px-6 py-2 border border-blue-200 text-blue-600 bg-white hover:bg-slate-50 rounded-full font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (createdCourseId) {
                     try {
                        const activeCurso = cursos.find(c => c.id === createdCourseId);
                        const currentConfig = activeCurso?.configuracao_json || {};
                        const { error } = await supabase.from('cursos').update({
                           configuracao_json: { ...currentConfig, videoSettings }
                        }).eq('id', createdCourseId);
                        if(error) console.error(error);
                        fetchCursos();
                     } catch(e) {}
                  }
                  setIsVideoSettingsModalOpen(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Adicionar tabela</h2>
              <button 
                onClick={() => setIsAddTableModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 rounded-full border border-blue-200 p-2 hover:bg-blue-50"
              >
                <X className="w-5 h-5 text-blue-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-700">
              <p>Defina o número de colunas e linhas.</p>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="flex items-center gap-2 font-medium mb-2">
                    Colunas 
                    <div className="w-4 h-4 border border-slate-400 rounded-sm flex">
                      <div className="w-1/2 h-full border-r border-slate-400"></div>
                    </div>
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={tableCols}
                    onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 font-medium mb-2">
                    Linhas 
                    <div className="w-4 h-4 border border-slate-400 rounded-sm flex flex-col">
                      <div className="w-full h-1/2 border-b border-slate-400"></div>
                    </div>
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={tableRows}
                    onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddTableModalOpen(false)}
                className="px-6 py-2 border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 rounded-full font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  let tableText = '<br/><table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;"><thead><tr>';
                  for (let i = 0; i < tableCols; i++) {
                    tableText += '<th style="border: 1px solid #e2e8f0; padding: 0.5rem; background-color: #f8fafc;">Cabeçalho</th>';
                  }
                  tableText += '</tr></thead><tbody>';
                  for (let i = 0; i < tableRows; i++) {
                    tableText += '<tr>';
                    for (let j = 0; j < tableCols; j++) {
                      tableText += '<td style="border: 1px solid #e2e8f0; padding: 0.5rem;">Célula</td>';
                    }
                    tableText += '</tr>';
                  }
                  tableText += '</tbody></table><br/>';
                  
                  applyCommand('insertHTML', tableText);
                  setIsAddTableModalOpen(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
      {isSelectQuestionsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Selecionar Questões</h2>
              <button 
                onClick={() => setIsSelectQuestionsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 rounded-full border border-blue-200 p-2 hover:bg-blue-50"
              >
                <X className="w-5 h-5 text-blue-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {availableQuestions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Nenhuma questão encontrada no banco de questões.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableQuestions.map(q => {
                    const isSelected = (editingStep.questoes_ids || []).includes(q.id);
                    return (
                      <div 
                        key={q.id} 
                        onClick={() => {
                          const newIds = isSelected 
                            ? (editingStep.questoes_ids || []).filter(id => id !== q.id)
                            : [...(editingStep.questoes_ids || []), q.id];
                          setEditingStep({...editingStep, questoes_ids: newIds});
                        }}
                        className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                      >
                        <div className={`mt-0.5 min-w-[20px] h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{q.texto}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 capitalize">Nível: {q.nivel || 'N/A'}</span>
                            <span className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-600">Categoria: {q.categoria || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsSelectQuestionsModalOpen(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
              >
                Concluir Seleção ({(editingStep.questoes_ids || []).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {isConvidarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Users className="w-5 h-5 text-blue-600" />
                Convidar Participantes
              </h2>
              <button 
                onClick={() => setIsConvidarModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-mails dos participantes (separados por vírgula)
              </label>
              <textarea 
                value={convidarEmails}
                onChange={(e) => setConvidarEmails(e.target.value)}
                className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                placeholder="exemplo@email.com, outro@email.com"
                rows={4}
              />
              <p className="text-sm text-slate-500 mt-2">
                Os participantes receberão um e-mail com o link de inscrição para este programa.
              </p>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsConvidarModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (!convidarEmails.trim()) {
                    alert('Por favor, informe ao menos um e-mail.');
                    return;
                  }
                  setIsEnviandoConvites(true);
                  // Simulate sending emails
                  setTimeout(() => {
                    setIsEnviandoConvites(false);
                    setIsConvidarModalOpen(false);
                    setConvidarEmails('');
                    alert('Os convites foram enviados com sucesso!');
                  }, 1500);
                }}
                disabled={isEnviandoConvites || !convidarEmails.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isEnviandoConvites ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  'Enviar Convites'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCertificateModalOpen && (
        <CertificateDesigner
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          onSave={handleSaveCertificate}
          initialTemplate={editingCertTemplate}
          targetName={createdCourseName}
        />
      )}

      {renderActionModal()}
    </div>
  );
}
