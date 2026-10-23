# Attobrain — plataforma e sessão guiada

## Uso local

A entrada `/` é o dashboard. Início, Alunos e Labirinto compartilham identidade e navegação. `/profissional` abre o fluxo de sessão; `/aluno` recebe o link temporário do profissional. `/legado` encaminha para a plataforma: a execução ilustrativa antiga não é mais oferecida.

Alunos continuam no `localStorage` `attobrain-students`, sem banco. A chave existente e seus registros são preservados; JSON local inválido gera erro sem sobrescrever o conteúdo. Nome, instituição e curso servem ao cadastro demonstrativo. O servidor recebe apenas ID, nome e marcação de demonstração, congelados na sessão. Alterar ou excluir o cadastro local não altera o histórico já registrado.

## Preparação e protocolo

Aluno → Configuração → Revisão → Treino → A → B → C → Resultados. Exploração usa Aluno → Configuração → Revisão → Atividade → Resultados.

O servidor controla a etapa, permissões e revisão de controle. Confirmar participante e validar configuração não criam tentativas nem iniciam EEG. A prévia usa a mesma geometria determinística da execução e permite inspecionar treino/A/B/C. As sementes avaliativas permanecem fixas no conjunto versionado. Somente exploração expõe semente livre.

Na revisão, abra a tela do aluno em janela separada e mantenha ambas visíveis lado a lado. O início e a retomada exigem conexão e presença visível recebida nos últimos cinco segundos. O aluno envia presença mesmo fora de execução. Popup bloqueado tem orientação de nova tentativa; ocultação, desconexão, entrada vencida ou atraso técnico pausam a execução. A proteção não foi removida.

“Iniciar sessão” congela os parâmetros e prepara o primeiro percurso. “Iniciar atividade” libera o movimento. A/B e B/C mantêm intervalo de 30–45 segundos e avanço explícito. Treino pode ser repetido até sete tentativas, sempre com IDs próprios e fora dos agregados. A/B/C não são substituídos. Conclusão, timeout e abandono permanecem distintos; finalizar C leva ao relatório, inclusive quando há insuficiência. Encerramento antecipado pede confirmação e motivo voluntário/técnico, gerando somente os resultados disponíveis.

O dashboard não cria sessões. Entrar em Labirinto cria ou restaura uma. A criação utiliza UUID de operação, guardado no navegador até confirmação. Recarregar restaura a mesma credencial; falha de recuperação exige ação explícita para criar outra sessão. O socket fica conectado ao navegar entre as telas da plataforma. `commandId` deduplica comandos; `expectedRevision` rejeita comandos baseados em controle desatualizado. A revisão de controle não muda com cada amostra.

## Camadas e contratos

- `src/domain/workflow.js`: participante, prévia, etapa e permissões.
- `src/domain/session.js`: relógio, histórico, execução e cache do relatório.
- `src/domain/analysis/`: qualidade, features, regras, evidências e geração de frases controladas.
- `src/controllers/realtime.js`: papéis, presença, comandos e sincronização.
- `public/modules/platform.js`: navegação e condução das telas, sem decidir transições críticas.
- `public/modules/students.js`: armazenamento e telas do cadastro local.
- `public/modules/interpretation-view.js`: resumo, dimensões, explicações e limitações.
- `src/types/workflow.d.ts`: contratos tipados. Não há framework ou runtime adicional.

`GET /api/protocol` fornece documentação JSON derivada do catálogo de comandos e defaults reais. Os registros de execução no terminal são estruturados, com tipo de comando, ID da sessão e revisão; não incluem credenciais, nomes ou observações.

Exemplo Socket.IO, após associação profissional:

```json
{"id":"SESSION_ID","commandId":"UUID","expectedRevision":0,"type":"select-participant","participant":{"id":"demo","name":"Participante demonstrativo"}}
```

```json
{"ok":true}
```

Configuração usa `type: "configure"` com `config`. Retorno seguro usa `type: "back"` e `step: "participant"` ou `"configuration"`. `begin` exige revisão e presença. `presence: {"visible":true}` é exclusivo do aluno. `preview` recebe configuração e retorna geometrias sem registrar eventos ou revisões.

Respostas de erro incluem `{"error":"Selecione o aluno primeiro."}`, `{"error":"O estado mudou. Confira a etapa atual e tente novamente."}` e `{"error":"Sessão não encontrada. Crie outra."}`. O aluno nunca recebe participante, relatório, métricas profissionais, notas ou EEG.

## Interpretação 1.0

Registros encerrados → qualidade → features → regras → evidências → texto em português. O relatório é armazenado por estado das execuções; não percorre o histórico inteiro a cada snapshot. Falha de análise preserva os dados e oferece recálculo.

Os critérios abaixo são operacionais de engenharia, sem validação clínica:

| Saída | Requisito |
|---|---|
| Contatos e trajetória | Registros existentes |
| Velocidade interpretativa | 30 s e cobertura válida ≥80% |
| CV interpretativo | 30 s, cobertura ≥80%, 40 janelas completas de 500 ms, média não nula |
| Baixa movimentação interpretativa | 30 s e cobertura ≥80% |
| Contatos/min interpretativos | 60 s e cobertura ≥80% |
| Recuperação mediana interpretativa | Três recuperações completas |
| Interpretação temporal | 45 s e 15 s válidos em cada terço |
| Comparação de pares | Duas conclusões comparáveis, ≥30 s e cobertura ≥80%, com métrica elegível |
| Tendência A/B/C | Três conclusões comparáveis e elegíveis |

Cobertura usa tempo com alvo válido dentro do quadro e entrada recente, dividido pelo tempo ativo; parada dentro do quadro é válida. Ausência de entrada não é baixa movimentação. Velocidade interpretativa usa distância e duração válidas; a média bruta original continua nos detalhes. CV interpretativo usa janelas de 500 ms e não atravessa lacunas/pausas; CV bruto é mantido separadamente.

A densidade adicional é `10 × contatos / (Lref / wc)`, com `wc = 1/colunas`, largura nominal do corredor na grade. Não substitui contatos/distância percorrida. Eficiência no grafo não significa ausência de contatos. Recuperações censuradas não viram zero.

Regras versionadas descrevem diferenças absolutas, direção, semelhança, oscilação, recuperação, regularidade, concentração temporal e velocidade/controle. Tolerâncias: 5 pontos percentuais de eficiência; 10% para contatos; 20% para padrões de velocidade, CV, recuperação e baixa movimentação. Percentuais com denominador zero não são calculados. Todas as observações têm regra, versão, critérios, execuções, valores, unidades e intervalos/eventos de evidência.

Comparabilidade usa conjunto, nível, modo e parâmetros comportamentais de execução. Configurações EEG não participam dessa decisão. O EEG tem origem sintética, fisiologia do participante falsa e elegibilidade interpretativa falsa. Não há escore de atenção, TDAH, normalidade ou confiança diagnóstica.

## Resultados e exportação

Resumo → dimensões em tabelas A/B/C → evidências expansíveis → métricas e área técnica. “Por que o sistema diz isso?” abre o critério e seus valores; “Ver percurso e instante” abre a linha do tempo correspondente. Exportar e imprimir ficam na área principal. Detalhes técnicos são opcionais na impressão.

JSON v3 inclui participante mínimo, motivo de encerramento, parâmetros por execução, qualidade, versões e relatório, além de todos os registros anteriores. Credenciais não são exportadas. Importação v2/v3 é somente leitura: preserva o relatório original e não presume qualidade ausente. Importar não modifica a sessão conectada. Reanálise ao vivo tem versão identificada; importação não recalcula silenciosamente o documento.

No fluxo guiado, o worker EEG começa somente após a revisão. O intervalo anterior é marcado como não coletado; não é preenchido retrospectivamente. Índices continuam alinhados ao relógio da sessão. `eeg.startIndex` indica o primeiro índice coletado e `samples` mantém o cursor final; amostras realmente armazenadas equivalem a `samples - startIndex`.

## Limites e verificação

Preservados: quatro sessões, 30 minutos de duração total, liberação após 30 minutos sem conexão, Worker/FFT/Welch, limites de entrada, exportação autenticada em streaming e inspeção limitada à janela EEG necessária. Dados de sessão são temporários. Sem persistência ou prontidão para escala pública.

`npm test` cobre domínio, rede, qualidade, rastreabilidade, privacidade, formato e regressões. `node scripts/verify-protocol.js caminho.json` gera uma fixture completa com o motor real, relógio acelerado e entrada automatizada, identificada no manifesto como teste sem participante real. Não é ensaio clínico nem medição humana.

A referência Figma não estava acessível nesta implementação. Identidade e componentes foram recuperados dos assets e do dashboard legado, sem atribuir propriedades não verificadas ao arquivo externo. A revisão visual considera 375/768/1024/1440 px, duas janelas, estados vazios, bloqueios e resultados parciais.
