import React, { useState } from 'react';
import { CreditCard, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    description: string;
    amount: number; // Em reais (ex: 99.90)
    type: 'curso' | 'modulo';
  };
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  participantId: string;
}

export function PaymentModal({ isOpen, onClose, item, customer, participantId }: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [card, setCard] = useState({ number: '', holder_name: '', exp_month: '', exp_year: '', cvv: '' });

  if (!isOpen) return null;

  const handlePayment = async () => {
    if (cpf.replace(/\D/g, '').length !== 11) {
      setError('Por favor, informe um CPF válido.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (paymentMethod === 'credit_card') {
        // 1. Tokenizar cartão
        const tokenRes = await fetch('/api/pagarme/tokenize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card: {
            number: card.number.replace(/\s/g, ''),
            holder_name: card.holder_name,
            exp_month: card.exp_month,
            exp_year: card.exp_year.length === 2 ? `20${card.exp_year}` : card.exp_year,
            cvv: card.cvv
          }})
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.message || 'Erro ao tokenizar cartão');

        // 2. Criar pedido com token
        const orderRes = await fetch('/api/pagarme/create-cc-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(item.amount * 100),
            customer: { name: customer.name, email: customer.email, cpf: cpf },
            items: [{ amount: Math.round(item.amount * 100), description: item.description, code: item.id }],
            metadata: {
              type: item.type, id: item.id, participant_id: participantId,                
              success_url: `${window.location.origin}/pagamento-sucesso?id=${participantId}`
            },
            card_token: tokenData.id
          })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.message || 'Erro ao criar pedido');
        window.location.href = `${window.location.origin}/pagamento-sucesso?id=${participantId}`;
      } else {
        // PIX (Flow existente)
        const response = await fetch('/api/pagarme/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(item.amount * 100),
            customer: { name: customer.name, email: customer.email, phone: customer.phone.replace(/\D/g, ''), cpf: cpf.replace(/\D/g, '') },
            items: [{ amount: Math.round(item.amount * 100), description: item.description, code: item.id }],
            metadata: {
              type: item.type, id: item.id, participant_id: participantId,
              success_url: `${window.location.origin}/pagamento-sucesso?id=${participantId}`
            }
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erro ao processar pagamento');
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      console.error('Payment Error:', err);
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCPF = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Pagamento da Inscrição
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <ShieldCheck className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-slate-500 mb-1">Valor da Inscrição</p>
            <h4 className="text-4xl font-black text-slate-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
            </h4>
          </div>

          <div className="space-y-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Item:</span>
                <span className="text-slate-900 font-bold">{item.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Participante:</span>
                <span className="text-slate-900 font-bold">{customer.name}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setPaymentMethod('pix')} className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${paymentMethod === 'pix' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>PIX</button>
              <button onClick={() => setPaymentMethod('credit_card')} className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${paymentMethod === 'credit_card' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>Cartão</button>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">CPF do Pagador *</label>
              <input 
                type="text"
                placeholder="000.000.000-00"
                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                maxLength={14}
              />
            </div>

            {paymentMethod === 'credit_card' && (
              <div className="space-y-2 pt-2">
                <input placeholder="Número do Cartão" className="w-full p-3 border rounded-lg" onChange={e => setCard({...card, number: e.target.value})}/>
                <input placeholder="Nome no Cartão" className="w-full p-3 border rounded-lg" onChange={e => setCard({...card, holder_name: e.target.value})}/>
                <div className="flex gap-2">
                   <input placeholder="MM" className="w-full p-3 border rounded-lg" onChange={e => setCard({...card, exp_month: e.target.value})}/>
                   <input placeholder="AA" className="w-full p-3 border rounded-lg" onChange={e => setCard({...card, exp_year: e.target.value})}/>
                   <input placeholder="CVV" className="w-full p-3 border rounded-lg" onChange={e => setCard({...card, cvv: e.target.value})}/>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs text-left overflow-auto max-h-32">
              <p className="font-bold mb-1">Não foi possível iniciar o pagamento:</p>
              {error}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                Ir para o Pagamento Seguro
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Ambiente de pagamento seguro via Pagar.me
          </p>
        </div>
      </div>
    </div>
  );
}
