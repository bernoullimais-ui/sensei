import React, { useState, useEffect } from 'react';
import { Building2, Users, Activity, Settings, Search, CheckCircle2, XCircle, Save, Trash2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ActionModal } from './ActionModal';

export function SuperAdminPanel() {
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'organizacoes' | 'super_admins'>('organizacoes');
  
  // Modal state
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type?: 'confirm', title?: string, message?: string, onConfirm?: () => void}>({ isOpen: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [orgRes, userRes] = await Promise.all([
        supabase.from('organizacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('*')
      ]);

      if (orgRes.data) setOrganizacoes(orgRes.data);
      if (userRes.data) setUsuarios(userRes.data);
    } catch (err) {
      console.error('Erro ao buscar dados do super admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!selectedOrg || !editingName.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizacoes')
        .update({ nome: editingName.trim() })
        .eq('id', selectedOrg.id);
        
      if (error) throw error;
      
      // Update local state
      setOrganizacoes(prev => prev.map(org => 
        org.id === selectedOrg.id ? { ...org, nome: editingName.trim() } : org
      ));
      
      setSelectedOrg(null);
    } catch (err) {
      console.error('Erro ao salvar organização:', err);
      alert('Erro ao salvar organização.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOrg = async (org: any) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Organização',
      message: `Tem certeza que deseja EXCLUIR DEFINITIVAMENTE a organização "${org.nome}" e TODOS os seus dados (usuários, avaliações, treinamentos)? Esta ação NÃO pode ser desfeita.`,
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.rpc('delete_organization', { org_id: org.id });
          if (error) throw error;
          
          setOrganizacoes(prev => prev.filter(o => o.id !== org.id));
          setUsuarios(prev => prev.filter(u => u.organizacao_id !== org.id));
        } catch (err: any) {
          console.error('Erro ao excluir organização:', err);
          alert('Erro ao excluir organização: ' + (err.message || 'Erro desconhecido.'));
        }
      }
    });
  };

  const handleToggleSuperAdmin = async (user: any) => {
    const newStatus = !user.is_super_admin;
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: newStatus ? 'Promover a Super Admin' : 'Remover Super Admin',
      message: newStatus 
        ? `Tem certeza que deseja promover "${user.nome}" a Super Admin? Ele terá acesso total a todas as organizações.`
        : `Tem certeza que deseja remover os privilégios de Super Admin de "${user.nome}"?`,
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.rpc('toggle_super_admin', { 
            user_id: user.id, 
            make_super_admin: newStatus 
          });
          if (error) throw error;
          
          setUsuarios(prev => prev.map(u => 
            u.id === user.id ? { ...u, is_super_admin: newStatus } : u
          ));
        } catch (err: any) {
          console.error('Erro ao alterar privilégios:', err);
          alert('Erro ao alterar privilégios: ' + (err.message || 'Erro desconhecido.'));
        }
      }
    });
  };

  const filteredOrgs = organizacoes.filter(org => 
    org.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = usuarios.filter(user => 
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando painel de administração...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel Super-Admin</h1>
        <p className="text-slate-500 mt-1">Gestão global da plataforma Sensei Assistente Digital</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{organizacoes.length}</div>
            <div className="text-sm font-medium text-slate-500">Organizações Ativas</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{usuarios.length}</div>
            <div className="text-sm font-medium text-slate-500">Usuários Totais</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{usuarios.filter(u => u.is_super_admin).length}</div>
            <div className="text-sm font-medium text-slate-500">Super Admins</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('organizacoes')}
          className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${activeTab === 'organizacoes' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Organizações
        </button>
        <button
          onClick={() => setActiveTab('super_admins')}
          className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${activeTab === 'super_admins' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Gestão de Super Admins
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">
            {activeTab === 'organizacoes' ? 'Organizações Cadastradas' : 'Todos os Usuários'}
          </h2>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'organizacoes' ? "Buscar organização..." : "Buscar usuário..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none w-full sm:w-64"
            />
          </div>
        </div>
        
        {activeTab === 'organizacoes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-4">Nome da Organização</th>
                  <th className="p-4">Data de Cadastro</th>
                  <th className="p-4">Usuários</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrgs.map((org) => {
                  const orgUsers = usuarios.filter(u => u.organizacao_id === org.id);
                  const adminUser = orgUsers.find(u => u.role === 'admin');
                  
                  return (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{org.nome}</div>
                        {adminUser && <div className="text-xs text-slate-500 mt-0.5">Admin: {adminUser.email}</div>}
                      </td>
                      <td className="p-4 text-slate-600">
                        {new Date(org.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {orgUsers.length} usuários
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedOrg(org);
                              setEditingName(org.nome);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Gerenciar Organização"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteOrg(org)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Organização"
                            disabled={org.id === '00000000-0000-0000-0000-000000000000'}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Nenhuma organização encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'super_admins' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-4">Usuário</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Organização</th>
                  <th className="p-4">Status Super Admin</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const userOrg = organizacoes.find(o => o.id === user.organizacao_id);
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{user.nome}</div>
                        <div className="text-xs text-slate-500 mt-0.5 capitalize">{user.role}</div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {user.email}
                      </td>
                      <td className="p-4 text-slate-600">
                        {userOrg?.nome || 'N/A'}
                      </td>
                      <td className="p-4">
                        {user.is_super_admin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Padrão
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleToggleSuperAdmin(user)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            user.is_super_admin 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                              : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                          }`}
                        >
                          {user.is_super_admin ? 'Remover Privilégio' : 'Promover a Super Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Organização */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-red-600" />
                Gerenciar Organização
              </h3>
              <button 
                onClick={() => setSelectedOrg(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Organização</label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="Nome da Federação/Clube"
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  Usuários Vinculados ({usuarios.filter(u => u.organizacao_id === selectedOrg.id).length})
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-500 font-medium sticky top-0">
                      <tr>
                        <th className="p-3">Nome</th>
                        <th className="p-3">E-mail</th>
                        <th className="p-3">Função</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {usuarios.filter(u => u.organizacao_id === selectedOrg.id).map(u => (
                        <tr key={u.id}>
                          <td className="p-3 font-medium text-slate-800">{u.nome}</td>
                          <td className="p-3 text-slate-600">{u.email}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'coordenador' ? 'bg-blue-100 text-blue-800' :
                              u.role === 'avaliador' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-slate-200 text-slate-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrg(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOrg}
                disabled={isSaving || !editingName.trim()}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
      {modalConfig.isOpen && (
        <ActionModal
          isOpen={modalConfig.isOpen}
          type={modalConfig.type as any}
          title={modalConfig.title || ''}
          message={modalConfig.message}
          onCancel={() => setModalConfig({ isOpen: false })}
          onConfirm={modalConfig.onConfirm}
        />
      )}
    </div>
  );
}
