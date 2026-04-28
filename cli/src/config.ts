import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.insighta');
const CONFIG_FILE = path.join(CONFIG_DIR, 'credentials.json');

export interface Credentials {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export function saveCredentials(creds: Credentials) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2));
}

export function getCredentials(): Credentials | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function clearCredentials() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
