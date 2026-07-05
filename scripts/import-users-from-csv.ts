import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type ImportUser = {
  email: string;
  password: string;
  displayName: string;
};

type ImportStats = {
  createdUsers: number;
  skippedExistingUsers: number;
  failedUsers: number;
  errors: string[];
};

type AuthUser = {
  id: string;
  email?: string;
};

type SupabaseAdminClient = {
  auth: {
    admin: {
      createUser: (attributes: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: { display_name: string };
      }) => Promise<{ data: { user: AuthUser | null }; error: { message: string } | null }>;
      listUsers: (params: { page: number; perPage: number }) => Promise<{ data: { users: AuthUser[] }; error: { message: string } | null }>;
    };
  };
  from: (table: 'profiles') => {
    upsert: (
      values: {
        id: string;
        email: string;
        display_name: string;
        role: 'player';
        status: 'approved';
        preferred_language: 'en';
      },
      options: { onConflict: 'id' },
    ) => Promise<{ error: { message: string } | null }>;
  };
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
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
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

async function findAuthUserByEmail(supabaseAdmin: SupabaseAdminClient, email: string) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to search auth users: ${error.message}`);
    }

    const existingUser = data.users.find(user => user.email?.toLowerCase() === normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function createOrReuseAuthUser(supabaseAdmin: SupabaseAdminClient, user: ImportUser) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      display_name: user.displayName,
    },
  });

  if (authData.user) {
    return { authUser: authData.user, created: true };
  }

  const authErrorMessage = authError?.message || '';
  if (/already|exists|registered/i.test(authErrorMessage)) {
    const existingUser = await findAuthUserByEmail(supabaseAdmin, user.email);
    if (existingUser) {
      return { authUser: existingUser, created: false };
    }
  }

  throw new Error(authErrorMessage || 'missing auth user');
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

  if (/^(sb_publishable_|sb_anon_|eyJ)/.test(process.env.VITE_SUPABASE_ANON_KEY || '') && serviceRoleKey === process.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must not reuse VITE_SUPABASE_ANON_KEY.');
  }

  if (serviceRoleKey.startsWith('sb_publishable_') || serviceRoleKey.startsWith('sb_anon_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a service role key, not an anon or publishable key.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseAdminClient;

  const users = readUsersFromCsv(path.resolve(process.cwd(), csvPath));
  const stats: ImportStats = {
    createdUsers: 0,
    skippedExistingUsers: 0,
    failedUsers: 0,
    errors: [],
  };

  console.log(`Importing ${users.length} users...`);

  for (const user of users) {
    try {
      const { authUser, created } = await createOrReuseAuthUser(supabaseAdmin, user);

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        email: user.email,
        display_name: user.displayName,
        role: 'player',
        status: 'approved',
        preferred_language: 'en',
      }, { onConflict: 'id' });

      if (profileError) {
        throw new Error(`Failed to upsert profile: ${profileError.message}`);
      }

      if (created) {
        stats.createdUsers += 1;
        console.log(`Created ${user.email}`);
      } else {
        stats.skippedExistingUsers += 1;
        console.log(`Reused existing auth user ${user.email}`);
      }
    } catch (error) {
      stats.failedUsers += 1;
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      const formattedError = `${user.email}: ${message}`;
      stats.errors.push(formattedError);
      console.error(`Failed ${formattedError}`);
    }
  }

  console.log('Import complete.');
  console.log(`Created users count: ${stats.createdUsers}`);
  console.log(`Skipped existing users count: ${stats.skippedExistingUsers}`);
  console.log(`Failed users count: ${stats.failedUsers}`);

  if (stats.errors.length > 0) {
    console.log('First 5 errors:');
    stats.errors.slice(0, 5).forEach(error => console.log(error));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
