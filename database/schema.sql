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
  observacoes        TEXT,
  ativo              BOOLEAN DEFAULT TRUE,
  criado_em          TIMESTAMP DEFAULT NOW(),
  atualizado_em      TIMESTAMP DEFAULT NOW()
);







