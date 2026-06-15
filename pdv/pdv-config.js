// ═══════════════════════════════════════════════
    // CONFIGURAÇÕES DO PDV
    // ═══════════════════════════════════════════════
    const PDV_CONFIG_KEY = 'nexoerp.pdv.config';

    const PDV_CONFIG_DEFAULTS = {
      pixTipoChave: 'aleatoria',
      pixChave: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
