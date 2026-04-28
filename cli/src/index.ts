#!/usr/bin/env bun
import { Command } from 'commander';
import open from 'open';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { api } from './api';
import { saveCredentials, clearCredentials, getCredentials } from './config';

const program = new Command();

program
  .name('insighta')
  .description('Insighta Labs+ CLI Tool')
  .version('1.0.0');

program
  .command('login')
  .aliases(['signin', 'signup'])
  .description('Login or Sign up with GitHub')
  .action(async () => {
    const spinner = ora('Initializing login...').start();
    try {
      // For CLI, we need a way to receive the token.
      // We'll start a temporary local server to catch the callback.
      const port = 7878;
      const callbackUrl = `http://localhost:${port}/callback`;
      
      const server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === '/callback') {
            const accessToken = url.searchParams.get('access_token');
            const refreshToken = url.searchParams.get('refresh_token');
            const userStr = url.searchParams.get('user');

            if (accessToken && refreshToken && userStr) {
              const user = JSON.parse(userStr);
              saveCredentials({ access_token: accessToken, refresh_token: refreshToken, user });
              spinner.succeed(chalk.green(`Successfully logged in as ${user.username} (${user.role})`));
              
              // Close the server after a short delay
              setTimeout(() => {
                server.stop();
                process.exit(0);
              }, 1000);

              return new Response('Success! You can close this window now.', { status: 200 });
            }
            return new Response('Login failed. Please try again.', { status: 400 });
          }
          return new Response('Not Found', { status: 404 });
        },
      });

      // The backend should redirect to our local server with the tokens
      // We pass the local callback URL as the redirect_to param
      // But wait, the backend handles the GitHub callback and then redirects to redirect_to.
      // So we need to point the backend to our local server.
      
      const authUrl = `http://localhost:3000/api/v1/auth/github?redirect_to=${encodeURIComponent(callbackUrl)}`;
      
      spinner.text = 'Opening browser for GitHub login...';
      await open(authUrl);
    } catch (err: any) {
      spinner.fail(chalk.red(`Login failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('profiles')
  .description('List profiles')
  .option('-p, --page <number>', 'Page number', '1')
  .option('-l, --limit <number>', 'Profiles per page', '10')
  .action(async (options) => {
    const spinner = ora('Fetching profiles...').start();
    try {
      const res = await api.get('/profiles', { params: options });
      spinner.stop();
      console.table(res.data.data.map((p: any) => ({
        Name: p.name,
        Age: p.age,
        Gender: p.gender,
        Country: p.country_name,
        Role: p.age_group
      })));
      console.log(chalk.dim(`Page ${res.data.metadata.page} of ${res.data.metadata.total_pages} (Total: ${res.data.metadata.total_count})`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.response?.data?.message || err.message}`));
    }
  });

program
  .command('search')
  .description('Search profiles using natural language')
  .argument('<query>', 'Natural language query')
  .action(async (query) => {
    const spinner = ora(`Searching for "${query}"...`).start();
    try {
      const res = await api.get('/profiles/search', { params: { q: query } });
      spinner.stop();
      if (res.data.data.length === 0) {
        console.log(chalk.yellow('No matching profiles found.'));
        return;
      }
      console.table(res.data.data.map((p: any) => ({
        Name: p.name,
        Age: p.age,
        Gender: p.gender,
        Country: p.country_name,
        Role: p.age_group
      })));
      console.log(chalk.dim(`Found ${res.data.metadata.total_count} results.`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.response?.data?.message || err.message}`));
    }
  });

program
  .command('export')
  .description('Export profiles to CSV (Admin only)')
  .action(async () => {
    const spinner = ora('Exporting profiles...').start();
    try {
      const res = await api.get('/profiles/export', { responseType: 'text' });
      const filename = `profiles_export_${Date.now()}.csv`;
      fs.writeFileSync(filename, res.data);
      spinner.succeed(chalk.green(`Export successful! Saved to ${filename}`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Error: ${err.response?.data?.message || err.message}`));
    }
  });

program
  .command('logout')
  .description('Logout and clear local credentials')
  .action(async () => {
    const creds = getCredentials();
    if (creds) {
      try {
        await api.post('/auth/logout', { refresh_token: creds.refresh_token });
      } catch {}
    }
    clearCredentials();
    console.log(chalk.green('Successfully logged out.'));
  });

program.parse();
