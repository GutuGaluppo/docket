# Prompt master — Protocolo de Candidaturas → produto SaaS freemium

> Cole este documento inteiro como primeira mensagem no Claude Code (ou no agente do VSCode) dentro de um diretório vazio. Ele foi escrito para ser executado em fases: peça uma fase por vez e revise antes de seguir.

---

## 1. Contexto

Existe um protótipo funcional em arquivo único (`controle-de-vagas.jsx`): um React component que registra candidaturas a vagas de emprego, com formulário no topo e tabela abaixo. Ele persiste dados via `window.storage` (API de artifact do Claude), que não existe fora daquele ambiente.

O objetivo é transformá-lo num produto web multiusuário, público, hospedado na Vercel, com modelo freemium. O protótipo é a especificação visual e funcional — a estética dele (papel, tinta violeta, carimbo de protocolo, tipografia Archivo + Courier Prime) deve ser preservada, não redesenhada.

**Funcionalidades do protótipo que precisam existir na v1:**

- Formulário: empresa, site da empresa (opcional), cidade com autocomplete que deduz o país, posição, descrição da vaga colada, observações livres.
- Detector de stack: varre o texto colado da vaga e transforma tecnologias reconhecidas em etiquetas removíveis, do apelido mais longo para o mais curto, com controle de trechos já consumidos (para "React Native" não gerar "React" duplicado). O dicionário tem ~100 tecnologias com apelidos.
- Data e hora locais preenchidas automaticamente no momento do registro, exibidas como carimbo.
- Logo da empresa via `logo.clearbit.com` com fallback para favicon do Google e, por último, monograma. Link para a homepage só quando o domínio é confiável.
- Tabela com busca, ordenação por coluna, remoção com confirmação em dois cliques, exportação CSV.
- Responsivo: a tabela vira cards abaixo de 760px.

---

## 2. Nome, identidade e voz

O produto se chama **Docket**.

Um _docket_ é um registro numerado de itens pendentes de decisão — uma pauta de processos aguardando veredito. É exatamente o que o app é: cada candidatura entra numerada, carimbada com data e hora locais, e fica esperando uma resposta que pode nunca vir. O nome não descreve a função (rastrear), descreve o objeto que o usuário passa a possuir: o registro da própria busca.

Isso importa para o código e para o texto, não só para o logo. **Adote esse vocabulário na interface inteira e nos nomes de rotas, tabelas e componentes:**

- Uma candidatura registrada é uma **entry**; o conjunto é **your docket**.
- O botão principal do formulário é **Stamp application** (não "Add", não "Submit").
- Tela vazia: _"Your docket is empty. Stamp your first application above."_
- O número sequencial (`Nº 001`) é o **protocol number** e aparece em toda entry.
- Rotas: `/docket`, `/docket/[id]`, `/docket/import`. Nada de `/dashboard`.

**Tom de voz:** seco, preciso, levemente burocrático — a voz de um cartório que gosta de você. Frases curtas, verbos ativos, zero entusiasmo de startup. Nunca "Awesome! 🎉". Nada de emoji na UI. O humor, quando existir, vem do contraste entre o rigor arquivístico e a bagunça emocional de procurar emprego — nunca de piada explícita.

**Identidade visual (já definida no protótipo, preserve):**

```
--paper  #DBD9D1   fundo, papel de arquivo
--card   #F7F6F2   superfícies
--ink    #191A17   texto
--muted  #6D6A61   texto secundário
--rule   #C2BFB5   fios e divisórias
--stamp  #6C3FA8   tinta violeta — acento único
--flag   #A93726   destrutivo
```

Tipografia: **Archivo** (interface, títulos) + **Courier Prime** (dados, números de protocolo, carimbos). Carregue via `next/font` com `display: swap`, sem `@import`.

**Elemento de assinatura:** o carimbo violeta de duplo contorno com data e hora. Ele é a única ousadia visual do produto — tudo em volta permanece silencioso. Ele aparece em cada entry, no favicon, no logo e nas imagens Open Graph. Não crie um segundo elemento chamativo para competir com ele.

**Logo:** a palavra "Docket" em Archivo 700, com o carimbo de contorno duplo envolvendo a letra inicial ou posicionado como selo à direita, levemente rotacionado (−3°). Entregue em SVG, versões clara e escura, mais favicon e `apple-touch-icon`.

Domínio: `docket.app` como primário (`usedocket.com` e `trydocket.com` como redirects). Antes de comprar, rode uma busca na EUIPO e na USPTO nas classes 9 e 42 — existem softwares chamados Docket em gestão de campo e no jurídico, mercados distintos do nosso, mas quero saber do risco antes de investir em SEO.

---

## 3. Landing page

A landing é o produto para quem ainda não é usuário. Ela é a **fase 5** do plano, mas leia isto antes de começar a fase 1 porque decisões de identidade vazam para o app.

### Objetivo

Uma única conversão: criar conta. Não colete e-mail para newsletter, não ofereça demo agendada, não coloque chat. O público é gente cansada, muitas vezes desempregada, avaliando a ferramenta às 23h. Cada passo extra é abandono.

### Estrutura

**Hero — a tese é a demonstração, não a promessa.**

Não escreva "a melhor forma de organizar sua busca" com um mockup ao lado. Coloque o **detector de stack funcionando ali mesmo**: uma caixa de texto com uma descrição de vaga real já pré-preenchida, as etiquetas aparecendo abaixo, e o cursor podendo apagar e colar qualquer outra vaga. Funciona sem login, sem chamada de rede (o detector é um módulo puro no cliente), e prova o valor em três segundos.

Ao lado ou abaixo, uma entry carimbada de exemplo, com o Nº 001 e o carimbo violeta. O título vem em Archivo 700, curto, factual. Algo na linha de _"Every application you send, on the record."_ Escreva três opções de headline e me mostre antes de fixar uma.

**Seções seguintes, nesta ordem:**

1. **Como funciona** — três passos, numerados, porque aqui a ordem é real: cole a vaga → confira as etiquetas → carimbe. Numeração só se justifica quando há sequência; não use em nenhuma outra seção.
2. **O que você passa a enxergar** — screenshot real do funil e do analytics de taxa de resposta por stack e por país. Sem mockups em ângulo, sem sombras dramáticas. A captura direta, com fio fino em volta.
3. **Privacidade e propriedade dos dados** — export CSV e JSON a qualquer momento, exclusão de conta em um clique, sem venda de dados, sem envio para recrutadores. Isso é objeção real do público e resolvê-la cedo converte.
4. **Preços** — tabela de dois planos, sem terceira coluna fantasma "Enterprise — fale conosco". Trial de 14 dias sem cartão dito em texto, não em asterisco. Preço regional detectado por IP com aviso explícito ("preço ajustado para o Brasil").
5. **FAQ** — em `<details>` nativo, indexável: o que acontece com meus dados se eu parar de pagar, posso exportar, funciona para vagas em qualquer idioma, o relatório serve como comprovação para o Jobcenter, como cancelo.
6. **Rodapé** — links legais, changelog, contato, status. Se a entidade for alemã, o Impressum é obrigatório por lei e precisa estar no rodapé de todas as páginas.

### Regras de construção

- **Server Components e HTML estático.** A landing inteira deve funcionar com JavaScript desabilitado, exceto o detector do hero. Nenhuma biblioteca de animação; se quiser movimento, use uma revelação sutil no scroll com `IntersectionObserver` e respeite `prefers-reduced-motion`.
- **Sem carrossel de logos de empresas** que você não usa como clientes, sem depoimentos inventados, sem contador de usuários falso. Enquanto não houver prova social real, o espaço fica vazio — vazio honesto converte melhor que prova social fabricada, e é o único caminho compatível com a voz do produto.
- Meta Lighthouse: 100 em performance, acessibilidade, best practices e SEO. LCP abaixo de 1,2s.
- **Open Graph dinâmico** com `@vercel/og`: cada página gera uma imagem com o carimbo violeta e o título. Compartilhamento no LinkedIn e no Twitter é canal principal aqui.
- Uma única CTA repetida no hero, no fim de preços e no fim da FAQ. Sempre com o mesmo rótulo — se é "Start your docket", é isso nos três lugares.

### SEO — o canal principal

A busca é de onde vem a maior parte do tráfego neste nicho: gente procurando "job application tracker", "planilha para controlar candidaturas", "Bewerbungen verwalten". Isso não é bônus, é a estratégia de distribuição.

- Rotas localizadas de verdade (`/en`, `/pt-br`, `/de`) com conteúdo escrito em cada idioma, não traduzido por máquina, e `hreflang` correto.
- Um blog em `/blog` com poucos artigos longos e úteis, não com volume: como estruturar um funil de candidaturas, o que responder quando o processo trava, como comprovar busca de emprego na Alemanha, o que os dados de 200 candidaturas dizem sobre taxa de resposta.
- Uma página de comparação honesta com as alternativas conhecidas do mercado, incluindo quando **não** usar o Docket. Página de comparação desonesta é descoberta e queima a marca.
- `sitemap.xml` e `robots.txt` gerados pelo App Router. JSON-LD de `SoftwareApplication` com preço e avaliação apenas quando as avaliações existirem de fato.

### Instrumentação

Eventos no PostHog: `landing_view`, `hero_detector_used` (o sinal mais importante — quem cola uma vaga de verdade no hero), `pricing_view`, `signup_started`, `signup_completed`, `first_entry_stamped`. O funil que interessa é hero → detector usado → conta criada → primeira entry carimbada.

---

## 4. Stack alvo

Use exatamente esta stack. Onde houver dúvida, prefira menos dependências.

| Camada          | Escolha                                                                                  | Por quê                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework       | **Next.js 15, App Router, TypeScript strict**                                            | Server Actions eliminam metade da camada de API; deploy nativo na Vercel |
| Estilo          | **Tailwind CSS 4** + CSS variables para os tokens do protótipo                           | O protótipo já usa variáveis; migre-as para `@theme`                     |
| Componentes     | **shadcn/ui** apenas para Dialog, Popover, Select, Toast                                 | Não use para o que já existe estilizado                                  |
| Banco           | **Postgres na Neon** (`@neondatabase/serverless`)                                        | Serverless driver, branch por PR, free tier generoso                     |
| ORM             | **Drizzle ORM + drizzle-kit**                                                            | Migrations versionadas, tipos inferidos                                  |
| Auth            | **Auth.js v5** com Google + GitHub + magic link via Resend                               | Público-alvo é dev; GitHub e Google cobrem quase tudo                    |
| Pagamentos      | **Stripe** (ver seção 8 — avalie Merchant of Record antes de decidir)                    |                                                                          |
| E-mail          | **Resend + React Email**                                                                 |                                                                          |
| Validação       | **Zod** — um schema por entidade, compartilhado entre form e server action               |                                                                          |
| Formulários     | **React Hook Form + zodResolver**                                                        |                                                                          |
| Estado servidor | **Server Components + Server Actions**; TanStack Query só em telas realmente interativas |                                                                          |
| Testes          | **Vitest** (unit) + **Playwright** (e2e dos fluxos críticos)                             |                                                                          |
| Analytics       | **Vercel Analytics** + **PostHog** (funil e feature flags)                               |                                                                          |
| Erros           | **Sentry**                                                                               |                                                                          |

Gerenciador de pacotes: **pnpm**. Editor: Zed/VSCode — mantenha `.editorconfig` e Prettier com config explícita no repo.

---

## 5. Arquitetura

```
src/
  app/
    (marketing)/           # landing, preços, changelog — estático, ISR
    (app)/
      dashboard/           # a tabela de candidaturas
      settings/
      billing/
    api/
      webhooks/stripe/     # única rota de API que precisa ser REST
    auth/
  components/
    protocolo/             # Carimbo, PilulasDeStack, LogoEmpresa, AutocompleteCidade
    ui/                    # shadcn
  server/
    actions/               # server actions, uma por caso de uso
    db/schema.ts
    db/queries/
    billing/               # cliente Stripe, mapeamento de planos, checagem de limites
  lib/
    detector-de-stack/     # dicionário + algoritmo (porte direto, sem reescrever)
    cidades/               # base cidade→país
    validacao/             # schemas Zod
```

Regras não negociáveis:

1. **Toda query filtra por `userId` na camada de query, nunca no componente.** Escreva um helper `queryDoUsuario()` e proíba acesso direto à tabela.
2. **Server Actions validam com Zod na entrada e checam sessão antes de qualquer coisa.** Sem exceção, mesmo em actions "internas".
3. **Checagem de limite de plano acontece no servidor**, em `server/billing/limites.ts`. A UI apenas reflete o que o servidor já decidiu.
4. **Nada de `any`.** `strict: true` e `noUncheckedIndexedAccess: true` no tsconfig.

---

## 6. Modelo de dados

```
users            (id, email, nome, imagem, criadoEm)          — Auth.js
subscriptions    (userId, stripeCustomerId, stripeSubscriptionId,
                  plano, status, periodoFim, cancelaNoFim)
applications     (id, userId, empresa, site, posicao,
                  cidade, pais, observacoes, statusId,
                  descricaoVaga, criadoEm, atualizadoEm)
application_tags (applicationId, tag)                          — as etiquetas de stack
status_events    (id, applicationId, status, ocorridoEm, nota) — histórico do processo
```

- `descricaoVaga` guarda o texto colado. É o que permite re-rodar o detector quando o dicionário crescer, e é a base para features de IA depois.
- Índices: `(userId, criadoEm desc)`, `(userId, empresa)`, `application_tags(tag)`.
- `status_events` é append-only. O `statusId` em `applications` é cache do último evento.

**Migração de dados do protótipo:** implemente `POST /api/import` que aceita o JSON exportado do artifact (array com `empresa, posicao, stacks[], cidade, pais, observacoes, site, criadoEm`) e o CSV. A tela de import deve ser a primeira coisa que um usuário novo vê se ele chegar com dados.

---

## 7. Freemium — onde fica a linha

O limite precisa doer no usuário que já provou valor, nunca no que está avaliando. Registrar candidaturas é a atividade central: limitá-la mata o hábito antes de ele se formar. Limite o que _acumula_ e o que _automatiza_.

**Free**

- Candidaturas ilimitadas (essa é a aposta: hábito primeiro)
- Detector de stack completo
- 1 board / 1 busca de emprego ativa
- Histórico de status limitado a 3 estágios (aplicado, entrevista, encerrado)
- Export CSV
- Lembretes de follow-up: não

**Pro — €5/mês ou €48/ano**

- Estágios de funil ilimitados e customizáveis, com Kanban
- Lembretes automáticos de follow-up por e-mail ("14 dias sem resposta da Empresa X")
- Analytics: taxa de resposta por stack, por país, por origem da vaga, tempo médio até primeira resposta
- Anexos por candidatura (versão do CV enviada, carta, print da vaga)
- Múltiplos boards (ex.: "Berlim frontend" e "remoto LATAM")
- Extensão de navegador que preenche a candidatura a partir da página da vaga
- Export PDF do relatório (útil para comprovação de busca de emprego junto ao Jobcenter/Agentur für Arbeit na Alemanha — argumento de venda forte e específico)

**Teams — €15/usuário/mês** (fase 3, só se houver demanda)

- Bootcamps e career coaches acompanhando alunos; visão agregada e comentários por candidatura

Regras de produto:

- Trial de 14 dias do Pro, **sem cartão**. Pedir cartão antes de provar valor derruba conversão num público que ainda está desempregado.
- Ao expirar, nada é apagado: features Pro ficam em modo leitura com um selo. Dado perdido é churn permanente.
- **Desconto regional por PPP** para BR/LATAM/Índia (~60%). O público brasileiro é grande e não paga €5 com a mesma facilidade — cobre proporcionalmente em vez de perder o mercado.
- Cupom permanente de 100% para quem está desempregado há mais de 6 meses, mediante pedido por e-mail, sem burocracia. Custo marginal quase zero, retorno em boca a boca alto.

---

## 8. Pagamentos — como estruturar

### Decisão anterior a qualquer código

Você tem duas rotas, e ela depende da entidade jurídica que vai faturar:

**Opção A — Stripe direto.** Taxa menor (~1,5% + €0,25 em cartões europeus). Mas _você_ passa a ser responsável por recolher e declarar IVA/VAT em cada país da UE onde vender (regime OSS), além do imposto de venda em outras jurisdições. Exige entidade constituída e contador. Faz sentido se você já tem ou vai abrir uma empresa na Alemanha ou em Portugal.

**Opção B — Merchant of Record (Lemon Squeezy, Paddle, Polar).** Taxa maior (~5% + €0,50). Em troca, a plataforma é a vendedora legal: ela recolhe e declara VAT/GST em todos os países, emite as faturas e lida com chargebacks. Você recebe um repasse líquido.

**Recomendação para começar: opção B.** Num produto que vai faturar €300–3.000/mês no primeiro ano, a diferença de taxa é de dezenas de euros por mês, enquanto a conformidade fiscal de VAT na UE custa muito mais que isso em contador e tempo. Migre para Stripe direto quando o MRR justificar — a abstração abaixo torna a troca barata.

**Implemente uma interface `ProvedorDePagamento`** com `criarCheckout()`, `abrirPortal()`, `sincronizarAssinatura(evento)`. Escreva o adaptador do MoR escolhido primeiro e o da Stripe depois. Nenhum componente de UI deve importar o SDK de pagamento diretamente.

### Fluxo (independente do provedor)

1. Usuário clica em Assinar → server action cria a sessão de checkout com `client_reference_id = userId` e devolve a URL.
2. Redirecionamento para a página hospedada do provedor. **Não construa formulário de cartão próprio** — isso joga você dentro do escopo de PCI sem necessidade.
3. Webhook em `/api/webhooks/stripe` (ou equivalente) — **essa é a única fonte de verdade sobre o estado da assinatura**. A página de retorno mostra "processando" e faz polling; ela nunca escreve no banco.
4. O webhook verifica a assinatura criptográfica do payload, é idempotente (tabela `webhook_events` com o id do evento como PK), e trata: `checkout.completed`, `subscription.updated`, `subscription.deleted`, `invoice.payment_failed`.
5. Portal do cliente hospedado para trocar cartão, ver faturas e cancelar. Não construa isso.

### Mercado brasileiro

Se BR virar uma fatia relevante, cartão internacional em euro é atrito real (IOF, limite, recusa). Nesse caso, ofereça um plano local separado em BRL, com **PIX e parcelamento**, via Stripe Brasil ou uma plataforma nacional. Trate isso como um segundo provedor atrás da mesma interface, e só depois de ter sinal de demanda — não na v1.

### Detalhes que economizam suporte depois

- Cobrança anual com 20% de desconto: melhora caixa e reduz churn mensal.
- Dunning automático (o provedor tenta de novo em 3, 5 e 7 dias) antes de rebaixar o plano.
- Ao cancelar, mantenha Pro até o fim do período pago.
- Uma pergunta única no cancelamento ("o que faltou?"), opcional, resposta livre.
- Guarde `plano` e `periodoFim` no seu banco. Nunca consulte a API do provedor no caminho de renderização.

---

## 9. Ordem de execução

Peça uma fase por vez.

**Fase 1 — fundação.** Projeto Next.js com a stack acima, tokens do protótipo migrados para Tailwind, Drizzle configurado, Auth.js com Google e GitHub, deploy na Vercel com Neon conectado e preview deployments por branch.

**Fase 2 — paridade.** Porte `detector-de-stack` e `cidades` como módulos puros com testes unitários (inclua os casos de "React Native não gera React", "JavaScript não gera Java", "go live não gera Go"). Reconstrua formulário e tabela como Server Components + Server Actions. Import de CSV/JSON. Neste ponto o produto já é usável e você migra seus próprios dados.

**Fase 3 — o que justifica pagar.** Funil de status com Kanban, lembretes de follow-up por e-mail (Vercel Cron + Resend), analytics de taxa de resposta, anexos (Vercel Blob).

**Fase 4 — monetização.** Interface `ProvedorDePagamento`, adaptador do MoR, checagem de limites no servidor, página de preços, trial, portal de cobrança, webhooks idempotentes.

**Fase 5 — distribuição.** Landing pública conforme a seção 3, changelog, extensão de navegador, i18n pt-BR/en/de com conteúdo escrito em cada idioma.

---

## 10. Definição de pronto (vale para toda fase)

- `pnpm typecheck`, `pnpm lint` e `pnpm test` passam.
- Nenhuma query sem filtro de `userId`; escreva um teste que tenta ler dado de outro usuário e espera erro.
- Teclado navega tudo, foco visível, `prefers-reduced-motion` respeitado.
- Lighthouse ≥ 95 em performance e acessibilidade na landing e no dashboard.
- Nenhum segredo no cliente; `.env.example` sempre atualizado.
- LGPD/GDPR: export completo dos dados e exclusão de conta funcionando desde a fase 2, não como item futuro.

---

## 11. Como quero trabalhar com você

- Antes de cada fase, liste os arquivos que vai criar ou alterar e espere meu ok.
- Faça um commit por unidade lógica, com mensagem em inglês no imperativo.
- Quando uma decisão tiver mais de um caminho defensável, apresente as opções com o trade-off em uma frase cada e recomende uma — não peça que eu escolha sem opinião sua.
- Não instale dependência que não esteja na seção 4 sem me dizer por quê.
- Comentários no código: em inglês, e apenas onde o "porquê" não é óbvio pelo "o quê".
