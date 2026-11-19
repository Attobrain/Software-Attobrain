CREATE DATABASE IF NOT EXISTS attobrain CHARACTER SET utf8mb4;
USE attobrain;

CREATE TABLE IF NOT EXISTS profissionais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  senha_hash VARCHAR(100) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS alunos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  profissional_id INT NOT NULL,
  nome VARCHAR(100) NOT NULL,
  data_nascimento DATE NULL,
  escola VARCHAR(100) NULL,
  turma VARCHAR(50) NULL,
  responsavel VARCHAR(100) NULL,
  observacoes VARCHAR(500) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS sessoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id INT NOT NULL,
  profissional_id INT NOT NULL,
  realizada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  nivel VARCHAR(30) NULL,
  fases_concluidas INT NOT NULL DEFAULT 0,
  tempo_ativo_seg INT NOT NULL DEFAULT 0,
  total_colisoes INT NOT NULL DEFAULT 0,
  motivo_fim VARCHAR(30) NULL,
  observacoes VARCHAR(4000) NULL,
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
) CHARACTER SET utf8mb4;

-- Conta de demonstração: profissional@attobrain.com / attobrain123
INSERT INTO profissionais (nome, email, senha_hash) VALUES
  ('Profissional de teste', 'profissional@attobrain.com', '$2b$10$5XDimOSotIlN.zEe7SB5dexPv6q2EKPA.PQVC3cYFxZQkUYOYB6mK')
ON DUPLICATE KEY UPDATE nome = 'Profissional de teste';

-- Alunos fictícios, apenas para demonstrar o sistema
INSERT INTO alunos (profissional_id, nome, data_nascimento, escola, turma, responsavel, observacoes) VALUES
  (1, 'Victor Gabriel Ferreira Theodoro', '2015-03-10', 'EE Antônio Fernandes Professor', '4º ano A', 'Responsável (fictício)', 'Cadastro fictício, apenas para demonstração.'),
  (1, 'Laura Julia Mathias Amaral', '2014-08-22', 'EE Alay José Correa Vereador', '5º ano B', 'Responsável (fictício)', 'Cadastro fictício, apenas para demonstração.'),
  (1, 'Millie Zanon Morelli Santos', '2016-01-05', 'EE Antônio Fernandes Professor', '3º ano A', 'Responsável (fictício)', 'Cadastro fictício, apenas para demonstração.'),
  (1, 'Mario Armando Takahashi Martins Dias', '2013-11-18', 'EE Alay José Correa Vereador', '6º ano A', 'Responsável (fictício)', 'Cadastro fictício, apenas para demonstração.'),
  (1, 'Luiz Henrique Severo Cubas', '2015-06-30', 'EE Antônio Fernandes Professor', '4º ano B', 'Responsável (fictício)', 'Cadastro fictício, apenas para demonstração.');
