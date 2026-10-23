# Attobrain — MVP multimodal do labirinto

HTML/CSS/JavaScript, Node.js e Socket.IO. Duas telas independentes, protocolo de treinamento + A/B/C, métricas observadas e EEG inteiramente sintético. Sem banco de dados, calibração, sensores reais ou classificação clínica. Dashboard e cadastro demonstrativo estão integrados ao fluxo guiado, com dados locais no navegador.

## Executar

Requer Node.js 22 ou superior. Na pasta do projeto:

```sh
npm ci
npm start
```

Abra http://localhost:3000/. O dashboard não cria sessões. Entre em **Labirinto**, selecione um aluno e configure a atividade. Confira a prévia, revise os parâmetros e abra a tela do aluno em uma janela separada. Mantenha as duas janelas visíveis, lado a lado; ocultar a tela do aluno pausa a atividade. O início só é liberado após conexão e visibilidade confirmadas.

**Iniciar sessão** prepara o treino; **Iniciar atividade** libera o movimento do mouse pelos corredores. O servidor valida cada transição. Após o treino, avance para A/B/C; os intervalos A/B e B/C são obrigatórios. Treino pode ser repetido até sete vezes, sempre fora da análise. Ao terminar C, a interface abre os resultados automaticamente. Encerramento antecipado confirma o motivo e produz um relatório parcial. Exploração usa quatro etapas, semente livre e nenhuma tendência A/B/C.

Em dois dispositivos na mesma rede, acesse `http://IP-DO-SERVIDOR:3000/profissional` e copie o link do aluno. Se necessário, substitua localhost pelo IP do servidor. Os dispositivos precisam alcançar a porta 3000. O software não altera firewall. Credenciais temporárias distinguem papéis, sem autenticação institucional. Não publicar diretamente na internet.

## Dados e resultados

O servidor limita velocidade, considera raio e paredes e registra o indicador aceito separadamente do alvo do mouse. Métricas incluem tempo ativo/pausado, checkpoints, distâncias contínua e no grafo, eficiência, velocidade/DP/CV, contatos, recuperação censurada, baixa movimentação, retrocessos e direção. Resultados individuais são congelados. Tendências A/B/C exigem três conclusões comparáveis; comparações parciais e dados insuficientes são identificados.

EEG sintético: 1/4/8 canais V1–V8, 250/500 Hz, semente independente, oscilações e ruído determinísticos, artefatos programados e modo interativo didático. Um worker gera blocos por índice; a análise usa Welch/Hann de oito segundos com FFT, PSD unilateral e bandas delta/theta/alpha/beta/gamma baixa. O gráfico usa envelope por pixel. Não há índices de atenção ou interpretação clínica. A área técnica mostra todos os canais, PSD, bandas, buffers, artefatos e conexões.

**EEG SINTÉTICO — não representa a atividade cerebral do participante.**

**MODULAÇÃO DIDÁTICA — sem equivalência fisiológica** no modo interativo. Contatos produzem uma rajada artificial de um segundo, associada ao evento de origem.

Exporte JSON antes de reiniciar ou fechar. Máximo de quatro sessões em memória, 30 minutos de duração total, remoção após 30 minutos sem conexão. Não há persistência no servidor. JSON v3 contém manifesto, aluno demonstrativo mínimo, motivo de encerramento, parâmetros/versionamento, registros brutos, métricas, qualidade, regras rastreáveis, eventos, notas e amostras sintéticas; omite credenciais. Download é autenticado por Bearer no cabeçalho e transmitido em partes. A inspeção temporal busca somente a janela EEG necessária. A importação v2/v3 é somente leitura e preserva o relatório original; formatos anteriores são rejeitados com explicação. Importações têm limite de 512 MiB e dependem da memória do navegador. Reprodução animada avançada permanece P2.

A camada de interpretação aplica critérios de suficiência por métrica e templates explicáveis; dados curtos ou incompletos têm limitações explícitas. Cada frase possui regra e evidências. O EEG sintético é excluído de todas as conclusões comportamentais. Consulte `/api/protocol` para a documentação automática dos comandos.

## Arquitetura

- `src/domain`: sessão, relógio monotônico, protocolo, conjuntos versionados, métricas puras e projeções por papel.
- `src/controllers`: autorização, idempotência, limites de entrada/comandos e deltas Socket.IO.
- `src/repositories`: retenção de sessões em memória.
- `src/services`: worker EEG, geração, Welch/FFT, exportação e inspeção.
- `src/validators` e `src/types`: configuração validada e contratos dos provedores futuros.
- `public/modules`: entrada, controles, desenho, gráficos, resultados e inspeção temporal.
- `engine.js`: geometria, solução, movimento e subpassos de colisão.
- `index.js` e `realtime.js`: pontos de entrada compatíveis.

JavaScript preserva a execução direta sem compilador; contratos TypeScript documentam as fronteiras. O dashboard e cadastro foram extraídos do legado; app.js e /legado encaminham à plataforma integrada. SIMULACAO.md descreve a versão anterior, não as fórmulas atuais.

## Testes e documentação

```sh
npm test
npm run test:soak
```

Testes unitários e de integração abrangem protocolo completo e parcial, relógios/pausas, geometria, colisões, trajetórias conhecidas, métricas, regras, privacidade, reconexão, origem, idempotência, exportação/importação, worker e potência de sinais conhecidos. `test:soak` gera o equivalente a 30 minutos reais de amostras e janelas espectrais por taxa, em tempo acelerado; não é um ensaio de 30 minutos de rede ou UI.

- [Fluxo guiado, critérios e contratos v3](docs/FLUXO-GUIADO.md)
- [Plano consolidado](docs/PLANO-MVP.md)
- [Protocolo, fórmulas e contratos](docs/PROTOCOLO.md)
- [Relatório de entrega e limites dos testes](docs/ENTREGA-MVP.md)

O projeto é um MVP local com capacidade limitada, sem garantia para 100.000 usuários. A identidade, persistência e escalabilidade distribuída precisam de arquitetura própria antes de produção.
