import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('cursos').select('*').limit(1);
  if (error) console.error(error);
  if (data && data.length > 0) {
    console.log("COLUMNS:", Object.keys(data[0]));
  }
}
test();
