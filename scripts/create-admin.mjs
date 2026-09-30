import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function loadDotEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

async function prompt(question) {
  const rl = createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

const env = { ...loadDotEnv('supabase/.env'), ...process.env };

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in supabase/.env');
  process.exit(1);
}

let email = env.ADMIN_EMAIL ?? '';
let password = env.ADMIN_PASSWORD ?? '';

email ||= await prompt('Admin email: ');
password ||= await prompt('Admin password (min 8 chars): ');

if (!email.includes('@') || password.length < 8) {
  console.error('Invalid email or password (must be at least 8 characters).');
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
try {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    if (error.code === 'user_already_exists') {
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const found = existingUser.users.find((u) => u.email === email);
      if (!found) {
        console.error('User exists but not found in directory.');
        process.exit(1);
      }
      userId = found.id;
    } else {
      throw error;
    }
  } else {
    userId = data.user.id;
  }
} catch (error) {
  console.error('Could not create admin user:', error.message);
  process.exit(1);
}

const { error: insertError } = await supabase
  .from('admins')
  .insert({ user_id: userId });

if (insertError) {
  console.error('Could not grant admin role:', insertError.message);
  process.exit(1);
}

console.log(
  `\nAdmin ready — ${email} can log in at /admin.\n`,
  'Tip: delete the script or store credentials in a password manager.',
);