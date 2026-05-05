import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('cursos').select('curriculo_json').limit(5);
  if (data) {
    data.forEach(d => {
      d.curriculo_json?.forEach(s => {
        s.etapas?.forEach(e => {
          if (e.nome === 'Como era') {
            console.log('FOUND Como era:', JSON.stringify(e));
          }
        });
      });
    });
  }
}
test();
