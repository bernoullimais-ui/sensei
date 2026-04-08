import { supabase } from './supabase';

export interface SyncTask {
  id: string;
  type: 'avaliacao' | 'treinamento_avaliacao';
  payload: any;
  timestamp: number;
}

const SYNC_QUEUE_KEY = 'sensei_sync_queue';

export const getSyncQueue = (): SyncTask[] => {
  const queue = localStorage.getItem(SYNC_QUEUE_KEY);
  return queue ? JSON.parse(queue) : [];
};

export const addToSyncQueue = (task: Omit<SyncTask, 'id' | 'timestamp'>) => {
  const queue = getSyncQueue();
  const newTask: SyncTask = {
    ...task,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  queue.push(newTask);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  
  // Dispatch event to update UI
  window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: queue }));
};

export const removeFromSyncQueue = (id: string) => {
  const queue = getSyncQueue();
  const newQueue = queue.filter(t => t.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(newQueue));
  
  // Dispatch event to update UI
  window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: newQueue }));
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = getSyncQueue();
  if (queue.length === 0) return;

  console.log(`Processing ${queue.length} items in sync queue...`);

  for (const task of queue) {
    try {
      if (task.type === 'avaliacao') {
        const { avaliacaoData, wazaInserts, kihonInserts, kataInserts, highDanInsert } = task.payload;
        
        // 1. Salvar a avaliação principal
        const { data: savedAvaliacao, error: avaliacaoError } = await supabase
          .from('avaliacoes')
          .insert([avaliacaoData])
          .select()
          .single();
          
        if (avaliacaoError) throw avaliacaoError;
        const avaliacaoId = savedAvaliacao.id;

        // 2. Salvar Waza
        if (wazaInserts && wazaInserts.length > 0) {
          const wazaWithId = wazaInserts.map((w: any) => ({ ...w, avaliacao_id: avaliacaoId }));
          const { error } = await supabase.from('avaliacao_waza').insert(wazaWithId);
          if (error) throw error;
        }

        // 3. Salvar Kihon
        if (kihonInserts && kihonInserts.length > 0) {
          const kihonWithId = kihonInserts.map((k: any) => ({ ...k, avaliacao_id: avaliacaoId }));
          const { error } = await supabase.from('avaliacao_kihon').insert(kihonWithId);
          if (error) throw error;
        }

        // 4. Salvar Kata
        if (kataInserts && kataInserts.length > 0) {
          const kataWithId = kataInserts.map((k: any) => ({ ...k, avaliacao_id: avaliacaoId }));
          const { error } = await supabase.from('avaliacao_kata').insert(kataWithId);
          if (error) throw error;
        }

        // 5. Salvar Alta Graduação
        if (highDanInsert) {
          const highDanWithId = { ...highDanInsert, avaliacao_id: avaliacaoId };
          const { error } = await supabase.from('avaliacao_alta_graduacao').insert([highDanWithId]);
          if (error) throw error;
        }
        
      } else if (task.type === 'treinamento_avaliacao') {
        const { error } = await supabase
          .from('treinamento_avaliacoes')
          .upsert(task.payload);
        if (error) throw error;
      }
      
      // If successful, remove from queue
      removeFromSyncQueue(task.id);
    } catch (err) {
      console.error(`Failed to sync task ${task.id}:`, err);
      // Keep in queue for next time
    }
  }
};

// Listen for online event to trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online! Processing sync queue...');
    processSyncQueue();
  });
}
