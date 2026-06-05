-- Segmentos de mercado
CREATE TABLE segmentos (
  id   SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
);

-- Empresas
CREATE TABLE empresas (
  id           SERIAL PRIMARY KEY,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(50),
  segmento_id  INTEGER REFERENCES segmentos(id),
  funcionarios VARCHAR(20),
  logradouro   VARCHAR(255),
  cidade       VARCHAR(100),
  estado       VARCHAR(2),
  cep          VARCHAR(9),
  criado_em    TIMESTAMP DEFAULT NOW()
);

-- Usuarios
CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER REFERENCES empresas(id),
  nome        VARCHAR(255) NOT NULL,
  sobrenome   VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  telefone    VARCHAR(20),
  cargo       VARCHAR(100),
  usuario     VARCHAR(100) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  criado_em   TIMESTAMP DEFAULT NOW()
);

-- Clientes
CREATE TABLE clientes (
  id                 SERIAL PRIMARY KEY,
  empresa_id         INTEGER REFERENCES empresas(id) NOT NULL,
  tipo_pessoa        VARCHAR(2) CHECK (tipo_pessoa IN ('PF', 'PJ')),
  nome               VARCHAR(150) NOT NULL,
  nome_fantasia      VARCHAR(150),
  cpf_cnpj           VARCHAR(18) NOT NULL UNIQUE,
  inscricao_estadual VARCHAR(30),
  telefone           VARCHAR(20),
  celular            VARCHAR(20),
  email              VARCHAR(150),
  cep                VARCHAR(10),
  logradouro         VARCHAR(150),
  numero             VARCHAR(20),
  bairro             VARCHAR(100),
  cidade             VARCHAR(100),
  estado             CHAR(2),
  complemento        VARCHAR(100),
  limite_credito     DECIMAL(10,2) DEFAULT 0,
  vendedor_id        INTEGER REFERENCES usuarios(id),
  observacoes        TEXT,

  ativo              BOOLEAN DEFAULT TRUE,
  criado_em          TIMESTAMP DEFAULT NOW(),
  atualizado_em      TIMESTAMP DEFAULT NOW()
);

-- Categorias de produto
CREATE TABLE categorias (
  id         SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  nome       VARCHAR(100) NOT NULL,
  ativo      BOOLEAN DEFAULT TRUE
);

-- Produtos
CREATE TABLE produtos (
  id                SERIAL PRIMARY KEY,
  empresa_id        INTEGER REFERENCES empresas(id) NOT NULL,
  categoria_id      INTEGER REFERENCES categorias(id),
  sku               VARCHAR(50) UNIQUE,
  codigo_barras     VARCHAR(50),
  nome              VARCHAR(150) NOT NULL,
  marca             VARCHAR(100),
  descricao         TEXT,
  unidade           VARCHAR(20) NOT NULL,
  preco_custo       NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_venda       NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_minimo      NUMERIC(10,2) DEFAULT 0,
  margem_lucro      NUMERIC(5,2) DEFAULT 0,
  desconto_maximo   NUMERIC(5,2) DEFAULT 0,
  ncm               VARCHAR(20),
  cest              VARCHAR(20),
  cfop              VARCHAR(10),
  cst_csosn         VARCHAR(10),
  aliquota_icms     NUMERIC(5,2) DEFAULT 0,
  pis_cofins        NUMERIC(5,2) DEFAULT 0,
  estoque           NUMERIC(10,3) NOT NULL DEFAULT 0,
  estoque_minimo    NUMERIC(10,3) DEFAULT 0,
  estoque_maximo    NUMERIC(10,3) DEFAULT 0,
  localizacao       VARCHAR(100),
  posicao_prateleira VARCHAR(50),
  fornecedor        VARCHAR(150),
  prazo_reposicao   INTEGER DEFAULT 0,
  ativo             BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em         TIMESTAMP DEFAULT NOW(),
  atualizado_em     TIMESTAMP DEFAULT NOW()
);





