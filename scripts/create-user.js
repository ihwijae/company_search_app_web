#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const DEFAULT_USERS_FILE = path.resolve(process.cwd(), 'users.yaml');

const parseArgs = (argv) => {
  const options = {
    id: '',
    role: 'admin',
    file: DEFAULT_USERS_FILE,
    active: true,
    mustChangePassword: false,
    passwordStdin: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--id') {
      options.id = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--role') {
      options.role = String(argv[i + 1] || '').trim() || 'admin';
      i += 1;
      continue;
    }
    if (arg === '--file') {
      options.file = path.resolve(process.cwd(), String(argv[i + 1] || '').trim());
      i += 1;
      continue;
    }
    if (arg === '--inactive') {
      options.active = false;
      continue;
    }
    if (arg === '--must-change-password') {
      options.mustChangePassword = true;
      continue;
    }
    if (arg === '--password-stdin') {
      options.passwordStdin = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const printHelp = () => {
  console.log(`Usage:
  node scripts/create-user.js --id <id> [options]

Options:
  --role <role>               Default: admin
  --file <path>               Default: ./users.yaml
  --inactive                  Create inactive account
  --must-change-password      Set mustChangePassword=true
  --password-stdin            Read password from stdin
  -h, --help                  Show help

Examples:
  node scripts/create-user.js --id admin
  node scripts/create-user.js --id manager --role user --file ./users.yaml
  printf 'StrongPassword123!\\n' | node scripts/create-user.js --id admin --password-stdin`);
};

const validateId = (id) => {
  if (!id) {
    throw new Error('Missing required --id value.');
  }
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(id)) {
    throw new Error('Invalid id format. Use 3-64 chars: A-Z a-z 0-9 . _ -');
  }
};

const readUsersFile = async (filePath) => {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid users file');
    }
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    return {
      version: Number(parsed.version || 1),
      users,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { version: 1, users: [] };
    }
    throw new Error(`Failed to parse users file (${filePath}). Use JSON-compatible YAML format.`);
  }
};

const writeUsersFile = async (filePath, doc) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(doc, null, 2)}\n`;
  await fs.promises.writeFile(filePath, serialized, { encoding: 'utf8', mode: 0o600 });
};

const promptHidden = (question) => new Promise((resolve, reject) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const onData = (char) => {
    const value = String(char);
    if (value === '\n' || value === '\r' || value === '\u0004') return;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`${question}${'*'.repeat(rl.line.length)}`);
  };

  process.stdin.on('data', onData);
  rl.question(question, (answer) => {
    process.stdin.removeListener('data', onData);
    rl.close();
    process.stdout.write('\n');
    resolve(String(answer || ''));
  });
  rl.on('error', (error) => {
    process.stdin.removeListener('data', onData);
    reject(error);
  });
});

const readPasswordFromStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLength = 64;
  const derivedKey = crypto.scryptSync(password, salt, keyLength, { N, r, p });
  return `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  validateId(options.id);

  const firstPassword = options.passwordStdin
    ? await readPasswordFromStdin()
    : await promptHidden('Password: ');

  if (!firstPassword) throw new Error('Password is required.');

  let finalPassword = firstPassword;
  if (!options.passwordStdin) {
    const confirmPassword = await promptHidden('Confirm Password: ');
    if (firstPassword !== confirmPassword) {
      throw new Error('Password confirmation does not match.');
    }
    finalPassword = confirmPassword;
  }

  const usersDoc = await readUsersFile(options.file);
  const existing = usersDoc.users.find((user) => String(user.id || '') === options.id);
  if (existing) {
    throw new Error(`User already exists: ${options.id}`);
  }

  const now = new Date().toISOString();
  const nextUser = {
    id: options.id,
    passwordHash: hashPassword(finalPassword),
    role: options.role,
    mustChangePassword: Boolean(options.mustChangePassword),
    active: Boolean(options.active),
    createdAt: now,
    updatedAt: now,
  };

  usersDoc.users.push(nextUser);
  await writeUsersFile(options.file, usersDoc);

  console.log(`User created: ${options.id}`);
  console.log(`Users file: ${options.file}`);
};

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
