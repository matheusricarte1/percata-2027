# Ícones usados pelo PERCATA

Esta pasta contém somente os módulos de ícones utilizados pela aplicação, extraídos de Lucide React 1.8.0 e Phosphor React 2.1.10. Os desenhos, renderizadores, variantes e contextos originais foram preservados. As licenças completas estão em `lucide/LICENSE` e `phosphor/LICENSE`; os manifestos registram versões, nomes exportados e módulos copiados.

Os dois pacotes completos deixaram de ser dependências instaladas. Cada tela importa diretamente o pequeno módulo em `lucide/exports/<nome>` ou `phosphor/exports/<nome>`, evitando carregar um catálogo central com todos os ícones.

## Adição e atualização

Para reutilizar um ícone presente, importe seu módulo em `exports`. Para incluir um novo ícone, prepare o pacote da versão registrada em um diretório temporário (por exemplo, usando `npm pack` e extraindo o arquivo), adicione o import com o nome original no código consumidor e execute o gerador correspondente:

```text
node scripts/vendor-lucide-icons.mjs --source <diretório-do-pacote-lucide-extraído>
node scripts/vendor-phosphor-icons.mjs --source <diretório-do-pacote-phosphor-extraído>
```

O argumento aponta para a pasta que contém o `package.json` do pacote extraído. Os geradores validam nome e versão, selecionam os imports usados no código e copiam apenas seus módulos e dependências internas. Não precisam manter esses pacotes em `node_modules`.

Uma troca de versão exige revisar os geradores, as licenças, as definições de tipos e a compatibilidade de renderização. Os módulos de terceiros não devem ser editados manualmente. Na migração inicial, 1.764 renderizações foram comparadas com os pacotes originais, incluindo os seis pesos Phosphor, acessibilidade, tamanho, classes e propriedades SVG; todas produziram HTML idêntico.
