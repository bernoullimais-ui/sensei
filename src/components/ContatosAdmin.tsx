import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Users, Search } from 'lucide-react';

interface ContatosAdminProps {
  loggedUser: any;
}

export function ContatosAdmin({ loggedUser }: ContatosAdminProps) {
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchParticipantes();
  }, [loggedUser]);

  const fetchParticipantes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('treinamento_participantes')
        .select('*')
        .eq('organizacao_id', loggedUser?.organizacao_id)
        .order('nome');

      if (error) throw error;
      
      // Remove duplicates by email/whatsapp if needed, or just show all
      // Let's show all but maybe group or just list them.
      // The user asked for names, email and whatsapp.
      
      // Let's deduplicate by email or whatsapp if they are the same person?
      // Actually, just listing them is fine.
      
      setParticipantes(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (participantes.length === 0) return;

    const headers = ['Nome', 'Email', 'WhatsApp'];
    const csvContent = [
      headers.join(','),
      ...participantes.map(p => 
        `"${p.nome || ''}","${p.email || ''}","${p.whatsapp || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'contatos_treinamentos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredParticipantes = participantes.filter(p => 
    (p.nome && p.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.whatsapp && p.whatsapp.includes(searchTerm))
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-red-600" /> Contatos de Treinamentos
        </h2>
        <button
          onClick={handleExportCSV}
          disabled={participantes.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou whatsapp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          Carregando contatos...
        </div>
      ) : filteredParticipantes.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
          Nenhum contato encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-sm">
                <th className="p-3 border-b font-semibold rounded-tl-lg">Nome</th>
                <th className="p-3 border-b font-semibold">Email</th>
                <th className="p-3 border-b font-semibold rounded-tr-lg">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipantes.map((p, idx) => (
                <tr key={p.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-800 font-medium">{p.nome}</td>
                  <td className="p-3 text-slate-600">{p.email || '-'}</td>
                  <td className="p-3 text-slate-600">{p.whatsapp || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
