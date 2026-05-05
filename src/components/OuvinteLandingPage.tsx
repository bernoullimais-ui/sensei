import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { PaymentModal } from './PaymentModal';

export function OuvinteLandingPage({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    // Determine path type and ID
    const path = window.location.pathname.split('/');
    const type = path[2];
    const id = path[3];
    
    // Fetch data based on type/id
    const fetchData = async () => {
      try {
        if (type === 'curso') {
            const { data } = await supabase.from('cursos').select('*').eq('id', id).single();
            setData({ type: 'curso', ...data });
        } else if (type === 'trilha') {
            const { data } = await supabase.from('trilhas').select('*').eq('id', id).single();
            setData({ type: 'trilha', ...data });
        } else if (type === 'full') {
            setData({ type: 'full', nome: 'Passaporte FULL', preco: 397 });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto"/></div>;
  if (!data) return <div className="p-20 text-center text-red-500">Item não encontrado</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-8">Acesso: {data.nome}</h1>
      <div className="bg-white p-6 rounded-xl border border-blue-200">
        <p className="text-xl">
          Preço: {data.type === 'curso' 
            ? (data.preco === 'gratuito' ? 'Gratuito' : (data.valor ? `R$ ${data.valor}` : 'Consulte')) 
            : `R$ ${data.preco}`}
        </p>
        <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">Comprar Agora</button>
      </div>
    </div>
  );
}