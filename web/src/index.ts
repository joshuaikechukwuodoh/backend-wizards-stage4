import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import crypto from "node:crypto";

const app = new Hono();

// Dynamic URL detection
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const BACKEND_URL = process.env.API_URL || (isVercel ? "/api/v1" : "http://localhost:3000/api/v1");
const WEB_URL = process.env.WEB_URL || (isVercel ? "" : "http://localhost:4000");

// CSRF Protection Middleware
app.get('/favicon.ico', (c) => c.body(null, 204));
app.use('*', async (c, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method)) {
    const csrfCookie = getCookie(c, 'csrf_token');
    const csrfHeader = c.req.header('X-CSRF-Token');
    if (!csrfCookie || csrfCookie !== csrfHeader) {
      return c.json({ status: 'error', message: 'CSRF token mismatch' }, 403);
    }
  }
  await next();
});

// Proxy helper for backend calls
async function proxyToBackend(c: any, path: string, method: string = 'GET', body: any = null) {
  const accessToken = getCookie(c, 'access_token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Node.js fetch (Vercel) requires absolute URLs
  let fullUrl = `${BACKEND_URL}${path}`;
  if (fullUrl.startsWith('/')) {
    const host = c.req.header('host') || 'localhost:4000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    fullUrl = `${protocol}://${host}${fullUrl}`;
  }

  try {
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    
    // Handle unauthorized - try refresh
    if (res.status === 401) {
       const refreshToken = getCookie(c, 'refresh_token');
       if (refreshToken) {
          let refreshUrl = `${BACKEND_URL}/auth/refresh`;
          if (refreshUrl.startsWith('/')) {
            const host = c.req.header('host') || 'localhost:4000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            refreshUrl = `${protocol}://${host}${refreshUrl}`;
          }
          const refreshRes = await fetch(refreshUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json() as any;
            setCookie(c, 'access_token', refreshData.access_token, { httpOnly: true, path: '/', maxAge: 900 });
            // Retry original
            headers['Authorization'] = `Bearer ${refreshData.access_token}`;
            const retryRes = await fetch(`${BACKEND_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
            return retryRes;
          }
       }
    }
    return res;
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response(JSON.stringify({ status: 'error', message: 'Backend unreachable' }), { status: 502 });
  }
}

// Internal Proxy Routes for Client-side
app.get('/api/me', async (c) => {
  const res = await proxyToBackend(c, '/auth/me');
  return c.json(await res.json(), res.status as any);
});

app.get('/api/users/me', async (c) => {
  const res = await proxyToBackend(c, '/auth/me');
  return c.json(await res.json(), res.status as any);
});

app.get('/api/profiles', async (c) => {
  const query = new URL(c.req.url).search;
  const res = await proxyToBackend(c, `/profiles${query}`);
  return c.json(await res.json(), res.status as any);
});

app.get('/api/profiles/search', async (c) => {
  const query = new URL(c.req.url).search;
  const res = await proxyToBackend(c, `/profiles/search${query}`);
  return c.json(await res.json(), res.status as any);
});

app.get('/api/profiles/export', async (c) => {
  const res = await proxyToBackend(c, '/profiles/export');
  if (!res.ok) return c.json(await res.json(), res.status as any);
  
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', res.headers.get('Content-Disposition') || 'attachment; filename=export.csv');
  return c.body(await res.text());
});

app.get('/', (c) => {
  const accessToken = getCookie(c, 'access_token');
  if (accessToken) return c.redirect('/dashboard');
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>Insighta Labs+ | Login</title>
        <link rel="stylesheet" href="/static/style.css">
    </head>
    <body class="login-page">
        <div class="login-card">
            <h1>Insighta Labs+</h1>
            <p>Secure Access & Profile Intelligence</p>
            <a href="${BACKEND_URL}/auth/github?redirect_to=${WEB_URL}/login-success" class="github-btn">
                Login with GitHub
            </a>
        </div>
    </body>
    </html>
  `);
});

app.get('/login-success', (c) => {
  const accessToken = c.req.query('access_token');
  const refreshToken = c.req.query('refresh_token');

  if (accessToken && refreshToken) {
    setCookie(c, 'access_token', accessToken, { httpOnly: true, path: '/', maxAge: 900 });
    setCookie(c, 'refresh_token', refreshToken, { httpOnly: true, path: '/', maxAge: 604800 });
  }

  const csrfToken = crypto.randomBytes(32).toString('hex');
  setCookie(c, 'csrf_token', csrfToken, { path: '/', maxAge: 604800 });

  return c.redirect('/dashboard');
});

app.get('/dashboard', (c) => {
  const accessToken = getCookie(c, 'access_token');
  if (!accessToken) return c.redirect('/');

  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>Insighta Labs+ | Dashboard</title>
        <link rel="stylesheet" href="/static/style.css">
    </head>
    <body>
        <nav>
            <div class="logo">Insighta Labs+</div>
            <div class="nav-links">
                <span id="user-info">Loading...</span>
                <button onclick="logout()" class="logout-btn">Logout</button>
            </div>
        </nav>
        <main>
            <section class="controls">
                <input type="text" id="search-input" placeholder="Search profiles...">
                <button onclick="loadProfiles(1)">Search</button>
                <button id="export-btn" onclick="exportData()" style="display:none;">Export CSV</button>
            </section>
            <div id="results">
                <table id="profile-table">
                    <thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Country</th></tr></thead>
                    <tbody id="profile-body"></tbody>
                </table>
            </div>
            <div class="pagination">
                <button id="prev-btn" onclick="changePage(-1)">Previous</button>
                <span id="page-info">Page 1</span>
                <button id="next-btn" onclick="changePage(1)">Next</button>
            </div>
        </main>
        <script>
            let currentPage = 1;
            const csrfToken = "${getCookie(c, 'csrf_token')}";

            async function fetchUser() {
                try {
                    const res = await fetch('/api/me');
                    if (res.status === 401) {
                         window.location.href = '/';
                         return;
                    }
                    const data = await res.json();
                    if (data.status === 'success' && data.user) {
                        const user = data.user;
                        document.getElementById('user-info').textContent = 'Logged in as ' + user.username + ' (' + user.role + ')';
                        if (user.role === 'admin') document.getElementById('export-btn').style.display = 'inline-block';
                    } else {
                        // Avoid redirect loop: only redirect if we're sure the session is dead
                        console.error('Session invalid:', data.message);
                    }
                } catch (e) {
                    console.error('Fetch user error:', e);
                }
            }

            async function loadProfiles(page = 1) {
                currentPage = page;
                const search = document.getElementById('search-input').value;
                const url = search 
                    ? '/api/profiles/search?q=' + encodeURIComponent(search) + '&page=' + page
                    : '/api/profiles?page=' + page;
                
                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    const body = document.getElementById('profile-body');
                    body.innerHTML = '';
                    if (data.status === 'success' && data.data) {
                        data.data.forEach(p => {
                            const row = '<tr><td>' + p.name + '</td><td>' + p.age + '</td><td>' + p.gender + '</td><td>' + p.country_name + '</td></tr>';
                            body.innerHTML += row;
                        });
                        document.getElementById('page-info').textContent = 'Page ' + data.metadata.page;
                    } else {
                        body.innerHTML = '<tr><td colspan="4">No profiles found or error loading.</td></tr>';
                    }
                } catch (e) {
                    console.error("Error loading profiles:", e);
                }
            }

            function changePage(delta) {
                loadProfiles(currentPage + delta);
            }

            function exportData() {
                window.location.href = '/api/profiles/export';
            }

            async function logout() {
                await fetch('/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
                window.location.href = '/';
            }

            fetchUser().then(() => loadProfiles());
        </script>
    </body>
    </html>
  `);
});

app.post('/logout', (c) => {
  deleteCookie(c, 'access_token');
  deleteCookie(c, 'refresh_token');
  deleteCookie(c, 'csrf_token');
  return c.json({ status: 'success' });
});

export default { port: 4000, fetch: app.fetch };

// --- Export for Vercel -----------------------------------------------
import { handle } from "hono/vercel";
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
