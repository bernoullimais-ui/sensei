import { supabase } from './src/lib/supabase.js';

async function checkCols() {
  const { data, error } = await supabase.from('cursos').select('*').limit(1);
  if (error) console.error(error);
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log("No data");
  }
}
checkCols();
