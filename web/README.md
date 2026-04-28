# Insighta Labs+ | Web Portal

Modern web dashboard for Insighta Labs+.

## Features
- **OAuth Integration**: Smooth login flow with GitHub.
- **Session Security**: HTTP-only cookies to prevent XSS-based token theft.
- **CSRF Protection**: Token-based validation for all state-changing requests.
- **RBAC Visibility**: UI elements (like Export) adjust based on user role.

## Setup
\`\`\`bash
cd web
bun install
bun run dev
\`\`\`
Access the portal at \`http://localhost:4000\`.
