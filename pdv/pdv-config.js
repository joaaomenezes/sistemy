// ═══════════════════════════════════════════════
    // CONFIGURAÇÕES DO PDV
    // ═══════════════════════════════════════════════
    const PDV_CONFIG_KEY = 'nexoerp.pdv.config';

    const PDV_CONFIG_DEFAULTS = {
      pixModo: 'manual',
      pixProvedor: null,
      pixAmbiente: 'sandbox',
      pixStatus: 'desconectado',
      pixWebhookPath: null,
      pixQrConfigured: false,
      pixTipoChave: 'aleatoria',
      pixChave: '',
      pixBeneficiario: 'Nexo ERP',
      pixCidade: 'SAO PAULO',
      terminalOperadora: 'demo',
      terminalId: '',
      jurosAPartirDe: 4,
      maxParcelas: 12,
      taxaJurosMensal: 0.0299,
      exigirFundo: false,
      exigirOperador: false,
      overtimeEnabled: true,
      overtimeHours: 8,
      notasRapidas: [10, 20, 50, 100, 200],
      lojaNome: 'NEXO ERP',
      lojaCnpj: '00.000.000/0001-00',
      lojaRodape: 'Obrigado pela preferência!',
    };

    function loadPdvConfig() {
      try {
        const saved = JSON.parse(localStorage.getItem(PDV_CONFIG_KEY) || 'null');
        return { ...PDV_CONFIG_DEFAULTS, ...(saved || {}) };
      } catch { return { ...PDV_CONFIG_DEFAULTS }; }
    }

    let PDV_CONFIG = loadPdvConfig();

    async function loadPdvConfigFromApi() {
      try {
        const [response, integration] = await Promise.all([
          NexoAuth.apiFetch('/configuracoes-pdv'),
          NexoAuth.apiFetch('/integracoes/pix'),
        ]);
        if (!response.ok || !response.data) {
          PDV_CONFIG.pixChave = '';
          return false;
        }
        Object.assign(PDV_CONFIG, response.data);
        if (integration.ok) {
          Object.assign(PDV_CONFIG, integration.data ? {
              pixModo: 'automatico',
              pixProvedor: integration.data.provedor,
              pixAmbiente: integration.data.ambiente,
              pixStatus: integration.data.status,
              pixWebhookPath: integration.data.webhookPath || null,
              pixQrConfigured: Boolean(integration.data.qrConfigured),
            } : {
              pixProvedor: null,
              pixStatus: 'desconectado',
              pixWebhookPath: null,
              pixQrConfigured: false,
            });
        }
        localStorage.setItem(PDV_CONFIG_KEY, JSON.stringify(PDV_CONFIG));
        return true;
      } catch (_) {
        PDV_CONFIG.pixChave = '';
        return false;
      }
    }
