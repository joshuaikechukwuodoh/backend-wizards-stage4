# Insighta Labs+ | CLI

Terminal interface for Insighta Labs+.

## Installation
\`\`\`bash
cd cli
bun install
# Globally link for local use
npm link 
\`\`\`

## Usage
- \`insighta login\`: Authenticate with GitHub.
- \`insighta profiles\`: List all profiles.
- \`insighta search "young females"\`: Search with natural language.
- \`insighta export\`: Download all data (Admin only).
- \`insighta logout\`: Clear local credentials.

## Token Handling
Tokens are stored securely in \`~/.insighta/credentials.json\`. The CLI automatically handles token refresh using the stored refresh token when an access token expires.
