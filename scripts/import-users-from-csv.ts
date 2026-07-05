import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type ImportUser = {
  email: string;
  password: string;
  displayName: string;
};

const requiredHeaders = ['email', 'password', 'display_name'] as const;
const defaultCsvPath = 'scripts/120-users-csv.csv';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(value.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function readUsersFromCsv(csvPath: string): ImportUser[] {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const headers = rows.shift()?.map(header => header.trim().toLowerCase());
  if (!headers) {
    throw new Error('CSV file is empty.');
  }

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`CSV is missing required header: ${header}`);
    }
  }

  const emailIndex = headers.indexOf('email');
  const passwordIndex = headers.indexOf('password');
  const displayNameIndex = headers.indexOf('display_name');

  return rows.map((row, index) => {
    const email = row[emailIndex]?.trim().toLowerCase();
    const password = row[passwordIndex]?.trim();
    const displayName = row[displayNameIndex]?.trim();

    if (!email || !password || !displayName) {
      throw new Error(`Row ${index + 2} must include email, password, and display_name.`);
    }

    return { email, password, displayName };
  });
}

async function main() {
  loadLocalEnv();

  const csvPath = process.argv[2] || defaultCsvPath;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL in .env.local.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const users = readUsersFromCsv(path.resolve(process.cwd(), csvPath));
  console.log(`Importing ${users.length} users...`);

  for (const user of users) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        display_name: user.displayName,
      },
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user ${user.email}: ${authError?.message || 'missing auth user'}`);
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      email: user.email,
      display_name: user.displayName,
      role: 'player',
      status: 'approved',
      preferred_language: 'en',
    });

    if (profileError) {
      throw new Error(`Failed to upsert profile ${user.email}: ${profileError.message}`);
    }

    console.log(`Imported ${user.email}`);
  }

  console.log('Import complete.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
