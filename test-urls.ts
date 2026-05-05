import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('cursos').select('curriculo_json').limit(5);
  if (data) {
    data.forEach(d => {
      d.curriculo_json?.forEach(s => {
        s.etapas?.forEach(e => {
          if (e.url_video) {
            console.log(e.url_video, JSON.stringify(e.url_video));
          }
        });
      });
    });
  }
}
test();
