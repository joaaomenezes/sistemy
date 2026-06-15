#!/bin/sh
# Gera config.js com a URL da API vinda da variável de ambiente do Netlify
API_URL="${API_URL:-http://localhost:3333/api}"
cat > config.js << EOF
const NEXO_CONFIG = { apiUrl: '${API_URL}' };
EOF
echo "config.js gerado com API_URL=${API_URL}"
