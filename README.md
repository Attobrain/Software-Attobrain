# Attobrain

Protótipo de front-end do fluxo mínimo demonstrativo do Attobrain. O projeto usa HTML, CSS, JavaScript e o servidor HTTP nativo do Node.js; não precisa instalar dependências.

## Executar

```bash
npm start
```

Abra [http://localhost:3000](http://localhost:3000). Os cadastros e a sessão atual ficam no `localStorage` do navegador. O labirinto aleatório registra o mouse e gera um canal de EEG sintético para a apresentação do PI. O relatório permite baixar as amostras em JSON. O protótipo não conecta sensores nem mede atenção.

As fórmulas, limitações e referências científicas estão em [SIMULACAO.md](SIMULACAO.md). A implementação do labirinto e do modelo está em `maze.js`, com JavaScript puro.
