const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
async function run() {
  const { data, error } = await supabase.from('settings').select('*');
  console.log(JSON.stringify(data, null, 2));
}
run();
