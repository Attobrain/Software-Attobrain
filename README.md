# Attobrain — MVP multimodal do labirinto

HTML/CSS/JavaScript, Node.js e Socket.IO. Duas telas independentes, protocolo de treinamento + A/B/C, métricas observadas e EEG inteiramente sintético. Sem banco de dados, calibração, sensores reais ou classificação clínica. O cadastro legado não foi ampliado.

## Executar

Requer Node.js 22 ou superior. Na pasta do projeto:

```sh
npm ci
npm start
```

Abra http://localhost:3000/profissional. Configure modo, nível, tempos e EEG e clique **Preparar sessão**. O protocolo congela os parâmetros. Abra **Tela do aluno** (janela) ou **Abrir aluno em aba**. Em dois monitores, mova a janela do aluno para o segundo monitor e use Tela cheia. Mantenha a tela do aluno visível: ocultá-la pausa a atividade.

Inicie o treino pelo profissional e mova o mouse pelos corredores na tela do aluno. Após concluir, encerrar ou atingir o limite, consulte o resultado e avance explicitamente. Entre A/B e B/C há uma pausa mínima de 30–45 segundos. Treinos podem ser repetidos até sete tentativas e nunca entram nos agregados. Avaliações não podem ser substituídas. Encerrar sessão preserva um consolidado parcial; não preenche atividades não realizadas. Atividade única permite exploração com semente livre.

Em dois dispositivos na mesma rede, acesse `http://IP-DO-SERVIDOR:3000/profissional` e copie o link do aluno. Se necessário, substitua localhost pelo IP do servidor. Os dispositivos precisam alcançar a porta 3000. O software não altera firewall. Credenciais temporárias distinguem papéis, sem autenticação institucional. Não publicar diretamente na internet.

## Dados e resultados

O servidor limita velocidade, considera raio e paredes e registra o indicador aceito separadamente do alvo do mouse. Métricas incluem tempo ativo/pausado, checkpoints, distâncias contínua e no grafo, eficiência, velocidade/DP/CV, contatos, recuperação censurada, baixa movimentação, retrocessos e direção. Resultados individuais são congelados. Tendências A/B/C exigem três conclusões comparáveis; comparações parciais e dados insuficientes são identificados.

EEG sintético: 1/4/8 canais V1–V8, 250/500 Hz, semente independente, oscilações e ruído determinísticos, artefatos programados e modo interativo didático. Um worker gera blocos por índice; a análise usa Welch/Hann de oito segundos com FFT, PSD unilateral e bandas delta/theta/alpha/beta/gamma baixa. O gráfico usa envelope por pixel. Não há índices de atenção ou interpretação clínica. A área técnica mostra todos os canais, PSD, bandas, buffers, artefatos e conexões.

**EEG SINTÉTICO — não representa a atividade cerebral do participante.**

**MODULAÇÃO DIDÁTICA — sem equivalência fisiológica** no modo interativo. Contatos produzem uma rajada artificial de um segundo, associada ao evento de origem.

Exporte JSON antes de reiniciar ou fechar. Máximo de quatro sessões em memória, 30 minutos de duração total, remoção após 30 minutos sem conexão. Não há persistência no servidor. JSON v2 contém manifesto, parâmetros/versionamento, registros brutos, métricas, regras, eventos, notas e amostras sintéticas; omite credenciais. Download é autenticado por Bearer no cabeçalho e transmitido em partes. A inspeção temporal busca somente a janela EEG necessária. A importação v2 é somente leitura; formatos anteriores são rejeitados com explicação. Importações têm limite de 512 MiB e dependem da memória do navegador. Reprodução animada avançada permanece P2.

## Arquitetura

- `src/domain`: sessão, relógio monotônico, protocolo, conjuntos versionados, métricas puras e projeções por papel.
- `src/controllers`: autorização, idempotência, limites de entrada/comandos e deltas Socket.IO.
- `src/repositories`: retenção de sessões em memória.
- `src/services`: worker EEG, geração, Welch/FFT, exportação e inspeção.
- `src/validators` e `src/types`: configuração validada e contratos dos provedores futuros.
- `public/modules`: entrada, controles, desenho, gráficos, resultados e inspeção temporal.
- `engine.js`: geometria, solução, movimento e subpassos de colisão.
- `index.js` e `realtime.js`: pontos de entrada compatíveis.

JavaScript preserva a execução direta sem compilador; contratos TypeScript documentam as fronteiras. Os arquivos legados app.js/maze.js e /legado continuam separados. SIMULACAO.md descreve a versão anterior, não as fórmulas atuais.

## Testes e documentação

```sh
npm test
npm run test:soak
```

Testes unitários e de integração abrangem protocolo completo e parcial, relógios/pausas, geometria, colisões, trajetórias conhecidas, métricas, regras, privacidade, reconexão, origem, idempotência, exportação/importação, worker e potência de sinais conhecidos. `test:soak` gera o equivalente a 30 minutos reais de amostras e janelas espectrais por taxa, em tempo acelerado; não é um ensaio de 30 minutos de rede ou UI.

- [Plano consolidado](docs/PLANO-MVP.md)
- [Protocolo, fórmulas e contratos](docs/PROTOCOLO.md)
- [Relatório de entrega e limites dos testes](docs/ENTREGA-MVP.md)

O projeto é um MVP local com capacidade limitada, sem garantia para 100.000 usuários. A identidade, persistência e escalabilidade distribuída precisam de arquitetura própria antes de produção.
