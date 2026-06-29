#!/bin/sh
# Gera config.js com a URL da API vinda da variavel de ambiente do Vercel
API_URL="${API_URL:-http://localhost:3333/api}"
cat > config.js << EOF
window.NEXO_CONFIG = { apiUrl: '${API_URL}' };
EOF
echo "config.js gerado com API_URL=${API_URL}"
