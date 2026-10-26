# Hospedar o Attobrain na web

## Arquitetura preparada

O frontend está preparado para publicação estática na Vercel. O backend Node.js/Socket.IO precisa de uma instância contínua, acessível por HTTPS e WebSocket, em um serviço de aplicação Node ou contêiner. Ambos os participantes usam o endereço público da Vercel; a aplicação conecta ao backend definido no build.

```text
Seu computador ── https://seu-projeto.vercel.app/profissional ─┐
                                                            ├─ HTTPS/WSS ─ servidor Node único
Computador do amigo ── link da Vercel /aluno#id=...&key=... ──┘
```

Vercel Functions já suporta WebSockets, mas a documentação informa que novas conexões podem chegar a instâncias diferentes e que conexões terminam ao atingir a duração máxima da função. O Attobrain tem motor contínuo, sessões e worker em memória. Publicar esse servidor diretamente como Function poderia separar profissional e aluno ou perder a atividade. Esta entrega preserva o motor em um processo Node e usa a Vercel para o frontend.

Referência: [WebSockets na Vercel](https://vercel.com/docs/functions/websockets), especialmente reconexão e estado persistente.

## 1. Publicar o servidor

Use um serviço que execute Node continuamente e aceite WebSocket (por exemplo, um Web Service Node em Render/Railway ou uma VPS). Consulte disponibilidade e condições no provedor escolhido.

- Repositório: este projeto, raiz atual.
- Instalação: `npm ci`.
- Inicialização: `npm start`.
- Runtime: Node.js 22 ou superior.
- Health check: `/health` (responde `{"ok":true}`).
- Variável `ALLOWED_ORIGINS`: domínio HTTPS exato da Vercel, sem barra final. Exemplo: `https://attobrain.vercel.app`.
- Porta: utilize `PORT` fornecida pelo provedor. O servidor já a respeita.
- Use **uma única instância/processo**, sem cluster ou escalonamento horizontal. A memória não é compartilhada entre réplicas.

O `Dockerfile` é uma alternativa para serviços de contêiner. Ele instala as dependências e inicia o mesmo `npm start`, com usuário sem privilégios. O backend pode servir a aplicação completa se aberto diretamente; a configuração padrão local continua válida.

## 2. Publicar o frontend na Vercel

Importe este repositório e use a raiz atual. O arquivo `vercel.json` define:

- Framework: Other (`null`).
- Build Command: `npm run build:web`.
- Output Directory: `dist`.
- Rotas `/`, `/profissional` e `/aluno` para a página principal.

Antes de publicar, cadastre `ATTOBRAIN_SERVER_URL` nas Environment Variables da Vercel, com a origem pública HTTPS do servidor, por exemplo `https://attobrain-api.exemplo.com`. Não inclua `/api`, `/socket.io`, query, fragmento ou credenciais. Esta variável é pública: não coloque segredo nela. O build falha na Vercel se ela estiver ausente ou inválida.

Depois de conhecer o domínio final da Vercel, atualize `ALLOWED_ORIGINS` no backend e reinicie o serviço Node. Para autorizar mais de um domínio, separe origens exatas por vírgula. Domínios de Preview precisam ser cadastrados explicitamente; não há liberação automática de todo `*.vercel.app`. Ao alterar a URL do backend, faça novo deploy do frontend.

O build copia somente os arquivos da interface e a biblioteca cliente Socket.IO, gerando `/runtime-config.js`. Não publica `src`, banco, testes, arquivos `.env` ou credenciais. A conexão usa WebSocket direto. Exportação e inspeção usam HTTP autenticado com CORS restrito às origens autorizadas.

## 3. Compartilhar uma atividade

1. Abra `https://seu-projeto.vercel.app/profissional`.
2. Selecione o aluno demonstrativo, configure e revise a atividade.
3. Use **Copiar link do aluno** e envie o link completo ao amigo.
4. Ele abre o link em seu computador e mantém a tela visível.
5. Aguarde a conexão do aluno e inicie a sessão e o percurso.

O link usa o endereço público do frontend e leva a credencial temporária do aluno no fragmento. Não precisa substituir localhost por IP e não exige a mesma rede. O link não deve ser publicado em redes sociais: quem o possui pode tentar ocupar o papel do aluno. O amigo não precisa criar cadastro no navegador dele. Áudio e tela cheia dependem de interação na tela dele.

Para a primeira conferência pública, conclua um percurso com as duas máquinas, teste pausa/retomada e faça download do JSON. Esta etapa só pode ser confirmada depois que os dois serviços estiverem publicados.

## Desenvolvimento e verificação local

`npm start` continua servindo frontend e backend na mesma origem. `runtime-config.js` local aponta para a mesma origem; nenhuma variável é obrigatória nesse modo. O build estático pode ser produzido com `npm run build:web`. Em publicação, defina a URL HTTPS do backend.

Execute `npm test` para verificar domínio, comunicação e integração entre origens. Os testes web cobrem duas telas associadas ao mesmo servidor, CORS autorizado/bloqueado, preflight autenticado, exportação e entrega dos arquivos de runtime.

Verificação desta preparação: 66 testes aprovados; build estático com origem HTTPS validado; ausência de URL na Vercel bloqueada; fontes privadas ausentes da saída. Nenhum deploy ou teste físico entre redes foi executado nesta etapa.

## Limitações atuais

Os dados continuam temporários: reiniciar, suspender ou fazer deploy do backend perde sessões ativas. Exporte o JSON antes. Um provedor que hiberna o processo pode atrasar a primeira conexão; escolha configuração adequada para uma apresentação contínua. O limite atual continua em quatro sessões, 30 minutos por sessão e limpeza após 30 minutos sem conexão. Compartilhar entre redes acrescenta latência: ela não transforma o mouse em sensor.

Esta preparação não adiciona login institucional, banco ou recuperação de sessões após reinício. Uma implantação pública com múltiplos servidores exige armazenamento e coordenação externos, além de autenticação apropriada. Nenhum serviço externo foi criado ou publicado automaticamente por esta alteração.
