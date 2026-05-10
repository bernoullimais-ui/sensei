import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MessageSquare, 
  Send, 
  User, 
  Clock, 
  Filter, 
  Plus, 
  X, 
  ThumbsUp,
  MoreVertical,
  Flag,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Users,
  Heart,
  Trash2,
  Inbox,
  Search,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Post {
  id: string;
  created_at: string;
  user_id: string;
  user_nome: string;
  user_role: string;
  content: string;
  title: string;
  category: 'Dúvidas' | 'Avisos' | 'Geral';
  organizacao_id: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
}

interface Comment {
  id: string;
  created_at: string;
  post_id: string;
  user_id: string;
  user_nome: string;
  user_role: string;
  content: string;
}

interface DirectMessage {
  id: string;
  created_at: string;
  sender_id: string;
  sender_nome: string;
  sender_role: string;
  receiver_id: string;
  receiver_nome: string;
  content: string;
  read: boolean;
}

interface UserSummary {
  id: string;
  nome: string;
  role: string;
}

interface CommunityProps {
  loggedUser: any;
  orgSettings: any;
}

export const Community: React.FC<CommunityProps> = ({ loggedUser, orgSettings }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'messages'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState<{ title: string; content: string; category: 'Dúvidas' | 'Avisos' | 'Geral' }>({ title: '', content: '', category: 'Geral' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // DM States
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [dmContent, setDmContent] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [currentAuthId, setCurrentAuthId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentAuthId(user.id);
    };
    checkAuth();
  }, []);

  const myId = useMemo(() => currentAuthId || loggedUser.auth_id || loggedUser.id, [currentAuthId, loggedUser]);

  const messagesState = useMemo(() => {
    const unreadMap: Record<string, number> = {};
    const lastMsgMap: Record<string, string> = {};

    messages.forEach(msg => {
      const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
      
      // Update last message date
      if (!lastMsgMap[otherId] || new Date(msg.created_at) > new Date(lastMsgMap[otherId])) {
        lastMsgMap[otherId] = msg.created_at;
      }

      // Update unread count (only messages sent TO me)
      if (msg.receiver_id === myId && !msg.read) {
        unreadMap[otherId] = (unreadMap[otherId] || 0) + 1;
      }
    });

    return { unreadMap, lastMsgMap };
  }, [messages, myId]);

  const filteredUsers = useMemo(() => {
    // Collect all unique user IDs from messages
    const allRelevantUsersMap = new Map<string, UserSummary>();
    
    // 1. First, populate with available users from the organization
    availableUsers.forEach(u => {
      allRelevantUsersMap.set(u.id, u);
    });

    // 2. Then, ensure anyone we've exchanged messages with is also included
    messages.forEach(m => {
      const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id;
      const otherNome = m.sender_id === myId ? m.receiver_nome : m.sender_nome;
      const otherRole = m.sender_id === myId ? '' : m.sender_role;
      
      if (!allRelevantUsersMap.has(otherId)) {
        allRelevantUsersMap.set(otherId, { id: otherId, nome: otherNome, role: otherRole });
      }
    });

    let users = Array.from(allRelevantUsersMap.values());

    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase();
      users = users.filter(u => 
        (u.nome || "").toLowerCase().includes(query) || 
        (u.role || "").toLowerCase().includes(query)
      );
    }

    // Sort by last message date (descending)
    return users.sort((a, b) => {
      const dateA = messagesState.lastMsgMap[a.id] || '0';
      const dateB = messagesState.lastMsgMap[b.id] || '0';
      if (dateA !== dateB) {
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      return (a.nome || "").localeCompare(b.nome || "");
    });
  }, [availableUsers, userSearchQuery, messagesState, messages, myId]);

  const isGestor = useMemo(() => {
    return loggedUser.role === 'admin' || 
           loggedUser.is_super_admin || 
           (loggedUser.role === 'avaliador' && (loggedUser.funcao === 'gestor' || loggedUser.funcao === 'coordenador'));
  }, [loggedUser]);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: postsData, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('organizacao_id', loggedUser?.organizacao_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user's likes to mark posts as liked
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPosts(postsData || []);
        return;
      }

      const { data: likesData } = await supabase
        .from('community_likes')
        .select('post_id')
        .eq('user_id', user.id);

      const likedPostIds = new Set(likesData?.map(l => l.post_id) || []);

      const formattedPosts = (postsData || []).map(p => ({
        ...p,
        is_liked: likedPostIds.has(p.id)
      }));

      if (selectedCategory !== 'Todos') {
        setPosts(formattedPosts.filter(p => p.category === selectedCategory));
      } else {
        setPosts(formattedPosts);
      }
    } catch (error: any) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loggedUser?.organizacao_id, loggedUser.id, selectedCategory]);

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchMessages = useCallback(async () => {
    if (!myId) return;
    try {
      const { data, error } = await supabase
        .from('community_messages')
        .select('*')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  }, [myId]);

  const fetchAvailableUsers = useCallback(async () => {
    if (!loggedUser?.organizacao_id || !myId) return;
    try {
      let query = supabase
        .from('usuarios')
        .select('id, nome, role')
        .eq('organizacao_id', loggedUser.organizacao_id)
        .neq('id', myId);

      // Extra security: filter locally too if myId or loggedUser.id are disparate
      const { data, error } = await query;
      if (error) throw error;
      
      let filtered = (data || []).filter(u => 
        u.id !== myId && 
        u.id !== loggedUser.id && 
        u.id !== (loggedUser.auth_id || '')
      );

      // If candidate, can only message admins/avaliadores
      if (loggedUser.role === 'candidato') {
        filtered = filtered.filter(u => ['admin', 'avaliador'].includes(u.role));
      }

      setAvailableUsers(filtered);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  }, [loggedUser.organizacao_id, myId, loggedUser.role]);

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchPosts();
    } else {
      fetchMessages();
      fetchAvailableUsers();
    }

    // Set up real-time for everything
    const postsChannel = supabase.channel('community_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Verify org
          if (payload.new.organizacao_id === loggedUser.organizacao_id) {
            setPosts(prev => {
              if (prev.find(p => p.id === payload.new.id)) return prev;
              return [payload.new as Post, ...prev];
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          setPosts(prev => prev.map(p => {
            if (p.id === payload.new.id) {
              // Mantemos o is_liked e permitimos que o servidor mande os contadores corrigidos
              return { ...p, ...payload.new, is_liked: p.is_liked };
            }
            return p;
          }));
        } else if (payload.eventType === 'DELETE') {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments' }, (payload) => {
        const newComm = payload.new as Comment;
        setComments(prev => ({
          ...prev,
          [newComm.post_id]: [...(prev[newComm.post_id] || []), newComm]
        }));
        // Update local count if trigger hasn't reached yet
        setPosts(prev => prev.map(p => p.id === newComm.post_id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, (payload) => {
        console.log('Realtime DM Insert:', payload);
        const newMsg = payload.new as DirectMessage;
        if (newMsg.sender_id === myId || newMsg.receiver_id === myId) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          
          // Auto-select and mark as read if it's from the person I'm currently chatting with
          if (newMsg.sender_id === selectedRecipientId && document.visibilityState === 'visible') {
            markAsRead(selectedRecipientId);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages' }, (payload) => {
        const updatedMsg = payload.new as DirectMessage;
        if (updatedMsg.sender_id === myId || updatedMsg.receiver_id === myId) {
          setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, [activeTab, fetchPosts, fetchMessages, fetchAvailableUsers, myId, loggedUser.organizacao_id]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      const { error } = await supabase
        .from('community_posts')
        .insert([{
          title: newPost.title,
          content: newPost.content,
          category: newPost.category,
          user_id: user.id,
          user_nome: loggedUser.nome,
          user_role: loggedUser.role,
          organizacao_id: loggedUser.organizacao_id,
        }]);

      if (error) throw error;

      setNewPost({ title: '', content: '', category: 'Geral' });
      setIsCreating(false);
    } catch (error: any) {
      alert('Erro ao publicar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateComment = async (postId: string) => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      const { error } = await supabase
        .from('community_comments')
        .insert([{
          post_id: postId,
          content: newComment,
          user_id: user.id,
          user_nome: loggedUser.nome,
          user_role: loggedUser.role
        }]);

      if (error) throw error;
      setNewComment('');
    } catch (error: any) {
      alert('Erro ao comentar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('community_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        if (error) throw error;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p));
      } else {
        // Like
        const { error } = await supabase
          .from('community_likes')
          .insert([{ post_id: postId, user_id: user.id }]);
        
        if (error) throw error;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 } : p));
      }
    } catch (error: any) {
      console.error('Error liking post:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Deseja realmente excluir esta postagem?')) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      const { error, count } = await supabase
        .from('community_posts')
        .delete({ count: 'exact' })
        .eq('id', postId);
      
      if (error) throw error;

      if (count === 0) {
        throw new Error('Você não tem permissão para excluir esta postagem ou ela já foi removida.');
      }
      
      // Update local state
      setPosts(prev => prev.filter(p => p.id !== postId));
      alert('Postagem excluída com sucesso!');
    } catch (error: any) {
      console.error('Delete error details:', error);
      alert('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Deseja excluir esta mensagem?')) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');

      const { error, count } = await supabase
        .from('community_messages')
        .delete({ count: 'exact' })
        .eq('id', messageId);

      if (error) throw error;
      
      if (count === 0) {
        throw new Error('Sem permissão para excluir esta mensagem.');
      }
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error: any) {
      console.error('Delete message error details:', error);
      alert('Erro ao excluir mensagem: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAsRead = async (recipientId: string) => {
    if (!myId) return;
    try {
      const { error } = await supabase
        .from('community_messages')
        .update({ read: true })
        .eq('receiver_id', myId)
        .eq('sender_id', recipientId)
        .eq('read', false);

      if (error) throw error;
      
      // Update local state for immediate feedback
      setMessages(prev => prev.map(m => 
        (m.sender_id === recipientId && m.receiver_id === myId) ? { ...m, read: true } : m
      ));
    } catch (error: any) {
      console.error('Error marking as read:', error);
    }
  };

  useEffect(() => {
    if (selectedRecipientId && myId) {
      markAsRead(selectedRecipientId);
    }
  }, [selectedRecipientId, myId]);

  const handleSendDM = async () => {
    if (!selectedRecipientId || !dmContent.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      const recipient = availableUsers.find(u => u.id === selectedRecipientId);
      const { error } = await supabase
        .from('community_messages')
        .insert([{
          sender_id: user.id,
          sender_nome: loggedUser.nome,
          sender_role: loggedUser.role,
          receiver_id: selectedRecipientId,
          receiver_nome: recipient?.nome || 'Usuário',
          content: dmContent,
          organizacao_id: loggedUser.organizacao_id
        }]);

      if (error) throw error;
      setDmContent('');
    } catch (error: any) {
      alert('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleComments = (postId: string) => {
    if (activePostId === postId) {
      setActivePostId(null);
    } else {
      setActivePostId(postId);
      if (!comments[postId]) {
        fetchComments(postId);
      }
    }
  };

  const filteredDMs = messages.filter(m => 
    (m.sender_id === myId && m.receiver_id === selectedRecipientId) ||
    (m.sender_id === selectedRecipientId && m.receiver_id === myId)
  );

  const categories = ['Todos', 'Dúvidas', 'Avisos', 'Geral'];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-red-600" />
            Comunidade
          </h1>
          <p className="text-slate-500 font-medium whitespace-nowrap">Espaço para interação entre a organização.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all border ${
              activeTab === 'feed' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Mural
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all border ${
              activeTab === 'messages' ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Mensagens
          </button>
        </div>
      </div>

      {activeTab === 'feed' ? (
        <>
          {/* Mural Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <Filter className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                    selectedCategory === cat 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-100 hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Postar
            </button>
          </div>

          {/* Feed */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando feed...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800">Nenhuma postagem ainda</h3>
                <p className="text-slate-500">Seja o primeiro a iniciar uma conversa!</p>
              </div>
            ) : (
              posts.map(post => (
                <motion.div
                  layout
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          post.user_role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900">{post.user_nome}</h4>
                            <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                              post.user_role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {post.user_role}
                            </span>
                            {post.user_role === 'admin' && <CheckCircle className="w-3 h-3 text-red-600" />}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            {new Date(post.created_at).toLocaleDateString()} às {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(isGestor || post.user_id === myId) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(post.id);
                            }}
                            disabled={isSubmitting}
                            className={`p-2 rounded-lg transition-all ${
                              isSubmitting ? 'opacity-30' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Excluir postagem"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          post.category === 'Avisos' ? 'bg-amber-100 text-amber-700' :
                          post.category === 'Dúvidas' ? 'bg-purple-100 text-purple-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {post.category}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-red-700 transition-colors uppercase tracking-tight">
                      {post.title}
                    </h3>
                    <p className="text-slate-600 font-medium leading-relaxed mb-6 whitespace-pre-wrap">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-6 pt-6 border-t border-slate-50">
                      <button 
                        onClick={() => handleLikePost(post.id, !!post.is_liked)}
                        className={`flex items-center gap-2 font-bold text-sm transition-all ${
                          post.is_liked ? 'text-red-600' : 'text-slate-400 hover:text-red-600'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${post.is_liked ? 'fill-current' : ''}`} />
                        {post.likes_count || 0}
                      </button>
                      <button 
                        onClick={() => toggleComments(post.id)}
                        className={`flex items-center gap-2 transition-all font-bold text-sm ${
                          activePostId === post.id ? 'text-red-600' : 'text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <MessageSquare className="w-5 h-5" />
                        {post.comments_count || 0} Comentários
                      </button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {activePostId === post.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50 border-t border-slate-100 overflow-hidden"
                      >
                        <div className="p-6 space-y-6">
                          <div className="space-y-4">
                            {(comments[post.id] || []).length === 0 ? (
                              <p className="text-center py-4 text-slate-400 font-medium text-sm italic">Nenhum comentário por enquanto.</p>
                            ) : (
                              (comments[post.id] || []).map(comment => (
                                <div key={comment.id} className="flex gap-4">
                                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                                    comment.user_role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-white border border-slate-200 text-slate-400'
                                  }`}>
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative group/comment">
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 text-sm">{comment.user_nome}</span>
                                        {comment.user_role === 'admin' && <span className="text-[8px] bg-red-100 text-red-700 px-1.5 rounded-full font-black uppercase">Admin</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-[10px] font-medium">
                                          {new Date(comment.created_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                                      {comment.content}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={newComment}
                              onChange={e => setNewComment(e.target.value)}
                              placeholder="Escreva um comentário..."
                              onKeyDown={e => e.key === 'Enter' && handleCreateComment(post.id)}
                              className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium transition-all shadow-sm"
                            />
                            <button
                              onClick={() => handleCreateComment(post.id)}
                              disabled={!newComment.trim() || isSubmitting}
                              className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-red-100"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Messages Tab */
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col md:flex-row h-[600px]">
          {/* User List */}
          <div className="w-full md:w-80 border-r border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-50">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm mb-4">Conversas</h3>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedRecipientId(user.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    selectedRecipientId === user.id ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    user.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{user.nome}</p>
                    <p className="text-[10px] uppercase font-black opacity-60 tracking-wider">
                      {user.role}
                    </p>
                  </div>
                  {messagesState.unreadMap[user.id] > 0 && (
                    <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                      <span className="text-[10px] text-white font-black">{messagesState.unreadMap[user.id]}</span>
                    </div>
                  )}
                  {selectedRecipientId === user.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-slate-50/30">
            {selectedRecipientId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 leading-tight">
                      {availableUsers.find(u => u.id === selectedRecipientId)?.nome}
                    </p>
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Online</p>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {filteredDMs.map(msg => {
                    const isMine = msg.sender_id === myId;
                    const canDelete = isGestor || isMine;

                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium shadow-sm relative group ${
                          isMine 
                            ? 'bg-red-600 text-white rounded-br-none' 
                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                        }`}>
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(msg.id);
                              }}
                              disabled={isSubmitting}
                              className={`absolute -top-2 ${isMine ? '-left-8' : '-right-8'} p-1.5 bg-white border border-slate-100 text-slate-400 hover:text-red-500 rounded-lg md:opacity-0 group-hover:opacity-100 transition-all shadow-sm ${
                                isSubmitting ? 'opacity-50' : ''
                              }`}
                              title="Excluir mensagem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <p className="leading-relaxed">{msg.content}</p>
                          <p className={`text-[9px] mt-1 text-right opacity-60 ${isMine ? 'text-white' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {filteredDMs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-50">
                      <MessageCircle className="w-10 h-10" />
                      <p className="font-bold text-sm">Sem mensagens. Comece o papo!</p>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 bg-white border-t border-slate-100">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={dmContent}
                      onChange={e => setDmContent(e.target.value)}
                      placeholder="Escreva sua mensagem..."
                      onKeyDown={e => e.key === 'Enter' && handleSendDM()}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium transition-all"
                    />
                    <button 
                      onClick={handleSendDM}
                      disabled={!dmContent.trim() || isSubmitting}
                      className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-red-200"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-60">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Suas Mensagens</h3>
                <p className="text-sm font-bold">Selecione um usuário para conversar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <form onSubmit={handleCreatePost}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-xl font-black text-slate-900">Nova Postagem</h3>
                  <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Título</label>
                    <input
                      required
                      type="text"
                      value={newPost.title}
                      onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                      placeholder="Sobre o que você quer falar?"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                    <div className="flex gap-2">
                      {(['Dúvidas', 'Avisos', 'Geral'] as const).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewPost({ ...newPost, category: cat })}
                          className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                            newPost.category === cat 
                              ? 'bg-slate-900 text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Conteúdo</label>
                    <textarea
                      required
                      rows={5}
                      value={newPost.content}
                      onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                      placeholder="Descreva sua dúvida ou comentário..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium transition-all"
                    />
                  </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Publicando...' : 'Publicar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
