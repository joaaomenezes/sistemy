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
