import React, { useState, useEffect, useMemo, useRef } from "react";

const STORAGE_KEY = "vagas:aplicacoes";

/* ---------------------------------------------------------------
   Base local de cidades → país. Fica no próprio arquivo para que a
   busca seja instantânea e funcione sem depender de rede.
--------------------------------------------------------------- */
const CIDADES_POR_PAIS = {
  Alemanha: ["Berlim", "Munique", "Hamburgo", "Colônia", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Hanôver", "Nuremberg", "Karlsruhe", "Bremen", "Essen", "Dortmund", "Freiburg", "Heidelberg", "Münster", "Aachen", "Potsdam"],
  Portugal: ["Lisboa", "Porto", "Braga", "Coimbra", "Aveiro", "Faro", "Funchal", "Guimarães", "Leiria", "Setúbal", "Évora", "Viseu"],
  Espanha: ["Madri", "Barcelona", "Valência", "Sevilha", "Bilbau", "Málaga", "Zaragoza", "Palma de Maiorca", "Alicante", "Granada", "Las Palmas", "Santa Cruz de Tenerife"],
  Brasil: ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Florianópolis", "Brasília", "Recife", "Fortaleza", "Salvador", "Campinas", "Goiânia", "Manaus", "Belém", "Vitória", "Natal", "João Pessoa", "Maceió", "São José dos Campos", "Joinville", "Londrina", "Ribeirão Preto", "Uberlândia", "Santos", "Sorocaba", "Blumenau", "Caxias do Sul", "Niterói", "Campo Grande", "Cuiabá", "Teresina", "São Luís", "Aracaju", "Palmas", "Juiz de Fora"],
  Holanda: ["Amsterdã", "Roterdã", "Haia", "Utrecht", "Eindhoven", "Groningen", "Delft", "Leiden", "Haarlem", "Nimega"],
  "Reino Unido": ["Londres", "Manchester", "Edimburgo", "Bristol", "Cambridge", "Oxford", "Birmingham", "Leeds", "Glasgow", "Brighton", "Liverpool", "Belfast", "Cardiff", "Sheffield", "Newcastle", "Reading"],
  Irlanda: ["Dublin", "Cork", "Galway", "Limerick"],
  França: ["Paris", "Lyon", "Marselha", "Toulouse", "Bordéus", "Nice", "Nantes", "Lille", "Estrasburgo", "Montpellier", "Rennes", "Grenoble", "Sophia Antipolis"],
  Itália: ["Milão", "Roma", "Turim", "Bolonha", "Florença", "Nápoles", "Veneza", "Pádua", "Trento", "Pisa", "Génova", "Verona"],
  Suíça: ["Zurique", "Genebra", "Basileia", "Berna", "Lausanne", "Lugano", "Zug", "Winterthur"],
  Áustria: ["Viena", "Graz", "Linz", "Salzburgo", "Innsbruck"],
  Bélgica: ["Bruxelas", "Antuérpia", "Gante", "Lovaina", "Bruges", "Liège"],
  Suécia: ["Estocolmo", "Gotemburgo", "Malmö", "Uppsala", "Lund", "Linköping"],
  Dinamarca: ["Copenhague", "Aarhus", "Odense", "Aalborg"],
  Noruega: ["Oslo", "Bergen", "Trondheim", "Stavanger"],
  Finlândia: ["Helsinque", "Espoo", "Tampere", "Turku", "Oulu"],
  Polônia: ["Varsóvia", "Cracóvia", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Katowice"],
  "República Tcheca": ["Praga", "Brno", "Ostrava", "Plzeň"],
  Estônia: ["Tallinn", "Tartu"],
  Letônia: ["Riga"],
  Lituânia: ["Vilnius", "Kaunas"],
  Romênia: ["Bucareste", "Cluj-Napoca", "Timișoara", "Iași", "Brașov"],
  Hungria: ["Budapeste", "Debrecen", "Szeged"],
  Bulgária: ["Sófia", "Plovdiv", "Varna"],
  Grécia: ["Atenas", "Tessalônica", "Patras"],
  Croácia: ["Zagreb", "Split", "Rijeka"],
  Sérvia: ["Belgrado", "Novi Sad", "Niš"],
  Eslovênia: ["Liubliana", "Maribor"],
  Eslováquia: ["Bratislava", "Košice"],
  Luxemburgo: ["Luxemburgo"],
  Malta: ["Valeta", "Sliema"],
  Ucrânia: ["Kiev", "Lviv", "Kharkiv", "Odessa"],
  Turquia: ["Istambul", "Ancara", "Izmir"],
  "Estados Unidos": ["São Francisco", "Nova York", "Seattle", "Austin", "Boston", "Los Angeles", "Chicago", "Denver", "Miami", "Atlanta", "Portland", "San Diego", "Washington", "Filadélfia", "Dallas", "Houston", "Phoenix", "Nashville", "Pittsburgh", "Minneapolis", "Raleigh", "Salt Lake City", "San Jose", "Palo Alto"],
  Canadá: ["Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary", "Waterloo", "Quebec", "Edmonton", "Halifax", "Victoria"],
  México: ["Cidade do México", "Guadalajara", "Monterrey", "Querétaro", "Mérida", "Puebla", "Tijuana"],
  Argentina: ["Buenos Aires", "Córdoba", "Rosário", "Mendoza", "La Plata"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "Viña del Mar"],
  Colômbia: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
  Uruguai: ["Montevidéu", "Punta del Este"],
  Peru: ["Lima", "Arequipa"],
  "Costa Rica": ["San José"],
  Panamá: ["Cidade do Panamá"],
  Austrália: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Camberra"],
  "Nova Zelândia": ["Auckland", "Wellington", "Christchurch"],
  Japão: ["Tóquio", "Osaka", "Quioto", "Yokohama", "Fukuoka", "Nagoya"],
  "Coreia do Sul": ["Seul", "Busan", "Incheon"],
  Singapura: ["Singapura"],
  China: ["Xangai", "Pequim", "Shenzhen", "Hangzhou", "Guangzhou", "Hong Kong"],
  Índia: ["Bangalore", "Hyderabad", "Mumbai", "Pune", "Deli", "Chennai", "Gurgaon", "Noida"],
  Indonésia: ["Jacarta", "Bali"],
  Tailândia: ["Banguecoque", "Chiang Mai"],
  Vietnã: ["Ho Chi Minh", "Hanói", "Da Nang"],
  Filipinas: ["Manila", "Cebu"],
  Malásia: ["Kuala Lumpur"],
  "Emirados Árabes Unidos": ["Dubai", "Abu Dhabi"],
  Israel: ["Tel Aviv", "Jerusalém", "Haifa"],
  "Arábia Saudita": ["Riade", "Jeddah"],
  Egito: ["Cairo", "Alexandria"],
  "África do Sul": ["Cidade do Cabo", "Joanesburgo", "Durban", "Pretória"],
  Quênia: ["Nairóbi"],
  Nigéria: ["Lagos", "Abuja"],
  Marrocos: ["Casablanca", "Rabat"],
  Remoto: ["Remoto — Global", "Remoto — Europa", "Remoto — União Europeia", "Remoto — Américas", "Remoto — Brasil"],
};

const CIDADES = Object.entries(CIDADES_POR_PAIS).flatMap(([pais, cidades]) =>
  cidades.map((cidade) => ({ cidade, pais }))
);

/* ---------------------------------------------------------------
   Dicionário de tecnologias. A chave é como a etiqueta aparece;
   a lista são as formas que podem aparecer escritas numa vaga.
--------------------------------------------------------------- */
const TECNOLOGIAS = {
  React: ["react", "react.js", "reactjs"],
  "Next.js": ["next.js", "nextjs"],
  Vue: ["vue", "vue.js", "vuejs", "vue 3"],
  Nuxt: ["nuxt", "nuxt.js"],
  Angular: ["angular", "angularjs"],
  "Svelte / SvelteKit": ["svelte", "sveltekit", "svelte kit"],
  Astro: ["astro"],
  Remix: ["remix"],
  TypeScript: ["typescript"],
  JavaScript: ["javascript", "js", "ecmascript", "es6"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3"],
  "Tailwind CSS": ["tailwind", "tailwind css", "tailwindcss"],
  "SASS / SCSS": ["sass", "scss", "less"],
  "Styled Components": ["styled-components", "styled components", "emotion"],
  "Three.js / WebGL": ["three.js", "threejs", "webgl", "react three fiber"],
  Redux: ["redux", "redux toolkit"],
  Zustand: ["zustand"],
  MobX: ["mobx"],
  "TanStack Query": ["tanstack query", "react query", "react-query", "tanstack"],
  Vite: ["vite"],
  Webpack: ["webpack", "rollup", "esbuild"],
  Storybook: ["storybook"],
  "Micro-frontends": ["micro-frontend", "micro frontends", "microfrontend", "module federation"],
  "SSR / SSG": ["ssr", "ssg", "isr", "server-side rendering", "static site generation"],
  PWA: ["pwa", "progressive web app"],
  "Web Components": ["web components", "lit"],
  "React Native": ["react native", "react-native"],
  Expo: ["expo"],
  Flutter: ["flutter", "dart"],
  "Swift / iOS": ["swift", "swiftui", "ios"],
  "Kotlin / Android": ["kotlin", "android"],
  "Node.js": ["node.js", "nodejs", "node"],
  Express: ["express", "express.js"],
  NestJS: ["nestjs", "nest.js"],
  Deno: ["deno"],
  Bun: ["bun"],
  Python: ["python"],
  Django: ["django"],
  FastAPI: ["fastapi"],
  Flask: ["flask"],
  Go: ["golang", "go lang"],
  Rust: ["rust"],
  Java: ["java"],
  Spring: ["spring", "spring boot"],
  ".NET / C#": [".net", "c#", "asp.net", "dotnet"],
  "Ruby on Rails": ["ruby on rails", "rails", "ruby"],
  PHP: ["php"],
  Laravel: ["laravel", "symfony"],
  "Elixir / Phoenix": ["elixir", "phoenix"],
  Scala: ["scala"],
  "C++": ["c++"],
  GraphQL: ["graphql", "apollo"],
  tRPC: ["trpc"],
  "REST APIs": ["rest api", "rest apis", "restful", "api rest"],
  gRPC: ["grpc"],
  WebSockets: ["websocket", "websockets", "socket.io"],
  PostgreSQL: ["postgresql", "postgres"],
  MySQL: ["mysql", "mariadb"],
  MongoDB: ["mongodb", "mongo"],
  Redis: ["redis"],
  Elasticsearch: ["elasticsearch", "opensearch"],
  Prisma: ["prisma"],
  Drizzle: ["drizzle"],
  Supabase: ["supabase"],
  Firebase: ["firebase"],
  AWS: ["aws", "amazon web services"],
  "Google Cloud": ["google cloud", "gcp"],
  Azure: ["azure"],
  Vercel: ["vercel"],
  Netlify: ["netlify"],
  Docker: ["docker"],
  Kubernetes: ["kubernetes", "k8s"],
  Terraform: ["terraform"],
  "CI/CD": ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
  "GitHub Actions": ["github actions", "gitlab ci", "circleci"],
  Git: ["git"],
  Kafka: ["kafka"],
  RabbitMQ: ["rabbitmq"],
  Sentry: ["sentry", "datadog"],
  Jest: ["jest"],
  Vitest: ["vitest"],
  Playwright: ["playwright"],
  Cypress: ["cypress"],
  "Testing Library": ["testing library", "react testing library"],
  TDD: ["tdd", "test driven development"],
  Figma: ["figma"],
  "Design System": ["design system", "design systems"],
  "Acessibilidade (a11y)": ["accessibility", "a11y", "wcag", "acessibilidade"],
  SEO: ["seo"],
  Analytics: ["google analytics", "amplitude", "mixpanel", "gtm"],
  "Testes A/B": ["a/b test", "a/b testing", "experimentation"],
  CMS: ["contentful", "sanity", "strapi", "headless cms"],
  WordPress: ["wordpress"],
  Shopify: ["shopify"],
  Stripe: ["stripe"],
  "AI / LLM": ["llm", "openai", "langchain", "genai", "machine learning", "ai/ml"],
  Monorepo: ["monorepo", "turborepo", "nx"],
  pnpm: ["pnpm"],
  "Agile / Scrum": ["scrum", "agile", "kanban", "ágil"],
};

const PARES_DE_APELIDOS = Object.entries(TECNOLOGIAS)
  .flatMap(([etiqueta, apelidos]) => apelidos.map((apelido) => ({ etiqueta, apelido })))
  .sort((a, b) => b.apelido.length - a.apelido.length);

const bloqueiaEsquerda = (c) => /[a-z0-9#.]/.test(c);
const bloqueiaDireita = (c) => /[a-z0-9+#]/.test(c);

/* Varre o texto do apelido mais longo para o mais curto e marca os
   trechos já consumidos, para que "React" não seja encontrado dentro
   de "React Native" nem "Java" dentro de "JavaScript". */
function detectarTecnologias(texto) {
  const t = texto.toLowerCase();
  if (!t.trim()) return [];

  const consumido = [];
  const encontrados = [];
  const vistos = new Set();

  for (const { etiqueta, apelido } of PARES_DE_APELIDOS) {
    let de = 0;
    for (;;) {
      const i = t.indexOf(apelido, de);
      if (i === -1) break;
      de = i + 1;
      const fim = i + apelido.length;
      const esquerda = i > 0 ? t[i - 1] : " ";
      const direita = fim < t.length ? t[fim] : " ";
      if (bloqueiaEsquerda(esquerda) || bloqueiaDireita(direita)) continue;
      if (consumido.some(([a, b]) => i < b && fim > a)) continue;
      consumido.push([i, fim]);
      if (!vistos.has(etiqueta)) {
        vistos.add(etiqueta);
        encontrados.push({ etiqueta, posicao: i });
      }
    }
  }

  return encontrados
    .sort((a, b) => a.posicao - b.posicao)
    .map((e) => e.etiqueta);
}

const semAcento = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function formatarCarimbo(iso) {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function tempoDecorrido(iso) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

const listaDeStacks = (r) =>
  Array.isArray(r.stacks) ? r.stacks : r.stack ? [r.stack] : [];

/* Limpa o que a pessoa colar: https://www.loudly.com/careers → loudly.com */
function normalizarDominio(entrada) {
  const t = entrada.trim().toLowerCase();
  if (!t) return "";
  return t
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\s+/g, "");
}

/* Palpite para quando o site não é informado: "Loudly GmbH" → loudly.com */
function dominioProvavel(nome) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(gmbh|ltda|inc|llc|ag|sa|s\.a\.|bv|b\.v\.|corp|co|group)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return base ? `${base}.com` : "";
}

function LogoEmpresa({ empresa, site }) {
  const dominio = site || dominioProvavel(empresa);
  const fontes = dominio
    ? [
        `https://logo.clearbit.com/${dominio}`,
        `https://www.google.com/s2/favicons?domain=${dominio}&sz=128`,
      ]
    : [];

  const [indice, setIndice] = useState(0);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    setIndice(0);
    setCarregou(false);
  }, [dominio]);

  const inicial = (empresa.trim()[0] || "?").toUpperCase();
  const esgotou = indice >= fontes.length;
  // Só vira link quando o domínio é confiável: informado por você,
  // ou confirmado pelo logo oficial ter carregado.
  const podeLinkar = Boolean(dominio) && (Boolean(site) || (indice === 0 && carregou));

  const marca = esgotou ? (
    <span className="pc-logo pc-logo-inicial" aria-hidden="true">
      {inicial}
    </span>
  ) : (
    <img
      className="pc-logo"
      src={fontes[indice]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => setCarregou(true)}
      onError={() => setIndice((i) => i + 1)}
    />
  );

  if (!podeLinkar) return marca;

  return (
    <a
      className="pc-logo-link"
      href={`https://${dominio}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir ${dominio}`}
    >
      {marca}
    </a>
  );
}

export default function ProtocoloDeCandidaturas() {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [estadoSalvo, setEstadoSalvo] = useState("ocioso");

  const [empresa, setEmpresa] = useState("");
  const [site, setSite] = useState("");
  const [posicao, setPosicao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");

  // Cidade → país
  const [textoCidade, setTextoCidade] = useState("");
  const [paisDetectado, setPaisDetectado] = useState("");
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  // Stacks reconhecidas a partir da descrição da vaga
  const [descricao, setDescricao] = useState("");
  const [dispensadas, setDispensadas] = useState([]);
  const [manuais, setManuais] = useState([]);
  const [stackManual, setStackManual] = useState("");

  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ campo: "criadoEm", direcao: "desc" });
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(null);

  const timerConfirmacao = useRef(null);
  const blocoCidade = useRef(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (ativo && res && res.value) {
          const dados = JSON.parse(res.value);
          if (Array.isArray(dados)) setRegistros(dados);
        }
      } catch (e) {
        // Ainda não há registro salvo.
      }
      if (ativo) setCarregando(false);
    })();
    return () => {
      ativo = false;
      if (timerConfirmacao.current) clearTimeout(timerConfirmacao.current);
    };
  }, []);

  useEffect(() => {
    function aoClicarFora(e) {
      if (blocoCidade.current && !blocoCidade.current.contains(e.target)) {
        setSugestoesAbertas(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const sugestoes = useMemo(() => {
    const termo = semAcento(textoCidade.trim());
    if (termo.length < 2) return [];
    const comeca = [];
    const contem = [];
    for (const item of CIDADES) {
      const alvo = semAcento(item.cidade);
      if (alvo.startsWith(termo)) comeca.push(item);
      else if (alvo.includes(termo) || semAcento(item.pais).startsWith(termo))
        contem.push(item);
      if (comeca.length >= 8) break;
    }
    return [...comeca, ...contem].slice(0, 8);
  }, [textoCidade]);

  async function gravar(proximos) {
    setRegistros(proximos);
    setEstadoSalvo("salvando");
    try {
      const res = await window.storage.set(
        STORAGE_KEY,
        JSON.stringify(proximos),
        false
      );
      setEstadoSalvo(res ? "salvo" : "erro");
    } catch (e) {
      setEstadoSalvo("erro");
    }
  }

  function escolherCidade(item) {
    setTextoCidade(item.cidade);
    setPaisDetectado(item.pais);
    setSugestoesAbertas(false);
    setIndiceAtivo(0);
  }

  function teclaCidade(e) {
    if (!sugestoesAbertas || sugestoes.length === 0) {
      if (e.key === "Enter") adicionar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => (i + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolherCidade(sugestoes[indiceAtivo]);
    } else if (e.key === "Escape") {
      setSugestoesAbertas(false);
    }
  }

  const detectadas = useMemo(() => detectarTecnologias(descricao), [descricao]);

  const stacks = useMemo(() => {
    const daVaga = detectadas.filter((s) => !dispensadas.includes(s));
    const extras = manuais.filter((s) => !daVaga.includes(s));
    return [...daVaga, ...extras];
  }, [detectadas, dispensadas, manuais]);

  function adicionarStack(valor) {
    const limpo = valor.trim();
    if (!limpo) return;
    const jaExiste = stacks.some((s) => s.toLowerCase() === limpo.toLowerCase());
    setDispensadas((d) => d.filter((s) => s.toLowerCase() !== limpo.toLowerCase()));
    if (!jaExiste) setManuais((m) => [...m, limpo]);
    setErro("");
  }

  function removerStack(valor) {
    setManuais((m) => m.filter((s) => s !== valor));
    if (detectadas.includes(valor)) {
      setDispensadas((d) => (d.includes(valor) ? d : [...d, valor]));
    }
  }

  function limparStacks() {
    setDescricao("");
    setDispensadas([]);
    setManuais([]);
    setStackManual("");
  }

  function adicionar() {
    const nomeEmpresa = empresa.trim();
    const cargo = posicao.trim();
    const cidade = textoCidade.trim();

    if (!nomeEmpresa) return setErro("Informe o nome da empresa.");
    if (!cargo) return setErro("Informe a posição para a qual você aplicou.");
    if (stacks.length === 0)
      return setErro(
        "Cole a descrição da vaga ou adicione uma tecnologia manualmente."
      );

    setErro("");
    const agora = new Date();
    const novo = {
      id: `${agora.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      numero: registros.length + 1,
      empresa: nomeEmpresa,
      site: normalizarDominio(site),
      posicao: cargo,
      stacks: [...stacks],
      observacoes: observacoes.trim(),
      cidade: cidade || "",
      pais: paisDetectado || "",
      local: [cidade, paisDetectado].filter(Boolean).join(", ") || "—",
      criadoEm: agora.toISOString(),
    };

    gravar([novo, ...registros]);
    setEmpresa("");
    setSite("");
    setPosicao("");
    setObservacoes("");
    setTextoCidade("");
    setPaisDetectado("");
    limparStacks();
  }

  function remover(id) {
    if (confirmandoRemocao !== id) {
      setConfirmandoRemocao(id);
      if (timerConfirmacao.current) clearTimeout(timerConfirmacao.current);
      timerConfirmacao.current = setTimeout(
        () => setConfirmandoRemocao(null),
        4000
      );
      return;
    }
    setConfirmandoRemocao(null);
    gravar(registros.filter((r) => r.id !== id));
  }

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    const filtrados = termo
      ? registros.filter((r) =>
          semAcento(
            [r.empresa, r.posicao, listaDeStacks(r).join(" "), r.local, r.observacoes || ""].join(" ")
          ).includes(termo)
        )
      : registros;

    const fator = ordem.direcao === "asc" ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      if (ordem.campo === "numero") return (a.numero - b.numero) * fator;
      const valor = (r) =>
        ordem.campo === "stack" ? listaDeStacks(r).join(", ") : r[ordem.campo] ?? "";
      return String(valor(a)).localeCompare(String(valor(b)), "pt-BR") * fator;
    });
  }, [registros, busca, ordem]);

  function exportarCSV() {
    const cabecalho = ["Nº", "Empresa", "Site", "Posição", "Stack", "País/Cidade", "Data da aplicação", "Observações"];
    const linhas = visiveis.map((r) => {
      const { data, hora } = formatarCarimbo(r.criadoEm);
      return [
        r.numero,
        r.empresa,
        r.site || "",
        r.posicao,
        listaDeStacks(r).join(" · "),
        r.local,
        `${data} ${hora}`,
        r.observacoes || "",
      ];
    });
    const csv = [cabecalho, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidaturas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function ordenarPor(campo) {
    setOrdem((o) =>
      o.campo === campo
        ? { campo, direcao: o.direcao === "asc" ? "desc" : "asc" }
        : { campo, direcao: "asc" }
    );
  }

  const esteMes = useMemo(() => {
    const agora = new Date();
    return registros.filter((r) => {
      const d = new Date(r.criadoEm);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    }).length;
  }, [registros]);

  const seta = (campo) =>
    ordem.campo === campo ? (ordem.direcao === "asc" ? "↑" : "↓") : "";

  return (
    <div className="pc-raiz">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Courier+Prime:wght@400;700&display=swap');

.pc-raiz {
  --paper: #DBD9D1;
  --card: #F7F6F2;
  --ink: #191A17;
  --muted: #6D6A61;
  --rule: #C2BFB5;
  --stamp: #6C3FA8;
  --stamp-soft: rgba(108, 63, 168, 0.08);
  --flag: #A93726;
  --font-ui: 'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-mono: 'Courier Prime', ui-monospace, 'SF Mono', Menlo, monospace;

  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  min-height: 100vh;
  padding: 40px 20px 80px;
  -webkit-font-smoothing: antialiased;
}
.pc-raiz * { box-sizing: border-box; }
.pc-wrap { max-width: 1080px; margin: 0 auto; }

.pc-cabecalho {
  display: flex; flex-wrap: wrap; align-items: flex-end;
  justify-content: space-between; gap: 16px;
  padding-bottom: 18px; border-bottom: 2px solid var(--ink);
}
.pc-eyebrow {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--stamp); margin: 0 0 6px;
}
.pc-titulo {
  margin: 0; font-size: clamp(28px, 5vw, 42px); font-weight: 700;
  letter-spacing: -0.02em; line-height: 1;
}
.pc-sub { margin: 8px 0 0; color: var(--muted); font-size: 14px; max-width: 46ch; }
.pc-contadores { display: flex; gap: 26px; font-family: var(--font-mono); }
.pc-contador b { display: block; font-size: 26px; font-weight: 700; line-height: 1; }
.pc-contador span {
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
}

.pc-form {
  background: var(--card); border: 1px solid var(--rule); border-radius: 3px;
  padding: 22px; margin-top: 26px;
  box-shadow: 3px 3px 0 rgba(25, 26, 23, 0.07);
}
.pc-form-titulo {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--muted); margin: 0 0 16px;
}
.pc-grade {
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}
.pc-campo { display: flex; flex-direction: column; gap: 6px; position: relative; }
.pc-campo-largo { grid-column: 1 / -1; }
.pc-campo label {
  font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
  font-weight: 600; color: var(--muted);
  display: flex; align-items: baseline; gap: 8px;
}
.pc-pais-detectado {
  font-family: var(--font-mono); text-transform: none; letter-spacing: 0.02em;
  color: var(--stamp); font-weight: 700;
}
.pc-campo input, .pc-campo select {
  font-family: var(--font-ui); font-size: 15px; color: var(--ink);
  background: transparent; border: 0; border-bottom: 1.5px solid var(--rule);
  padding: 7px 2px; border-radius: 0; width: 100%;
  transition: border-color .15s ease;
}
.pc-campo select { appearance: none; cursor: pointer; }
.pc-campo input:focus, .pc-campo select:focus { outline: none; border-bottom-color: var(--stamp); }
.pc-campo input:focus-visible, .pc-campo select:focus-visible {
  outline: 2px solid var(--stamp); outline-offset: 3px;
}
.pc-campo input::placeholder { color: #A8A59B; }

/* Autocomplete de cidade */
.pc-sugestoes {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 30;
  margin: 4px 0 0; padding: 4px; list-style: none;
  background: #FFFEFB; border: 1px solid var(--stamp); border-radius: 3px;
  box-shadow: 3px 3px 0 rgba(25, 26, 23, 0.12); max-height: 260px; overflow-y: auto;
}
.pc-sugestao {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 9px 10px; cursor: pointer; border-radius: 2px; font-size: 14px;
}
.pc-sugestao[aria-selected="true"] { background: var(--stamp); color: #fff; }
.pc-sugestao[aria-selected="true"] .pc-sugestao-pais { color: rgba(255,255,255,0.82); }
.pc-sugestao-pais { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }

/* Descrição da vaga */
.pc-dica-inline {
  font-family: var(--font-mono); text-transform: none; letter-spacing: 0.01em;
  font-weight: 400; color: #A8A59B; font-size: 11px;
}
.pc-textarea {
  font-family: var(--font-ui); font-size: 14px; line-height: 1.5; color: var(--ink);
  background: #FFFEFB; border: 1px solid var(--rule); border-radius: 2px;
  padding: 12px; width: 100%; resize: vertical; min-height: 108px;
  transition: border-color .15s ease;
}
.pc-textarea:focus { outline: none; border-color: var(--stamp); }
.pc-textarea:focus-visible { outline: 2px solid var(--stamp); outline-offset: 2px; }
.pc-textarea::placeholder { color: #A8A59B; }
.pc-textarea-curto { min-height: 62px; }

/* Logo da empresa */
.pc-empresa-bloco { display: flex; align-items: center; gap: 11px; }
.pc-logo {
  width: 28px; height: 28px; flex: 0 0 28px; object-fit: contain;
  background: #FFFEFB; border: 1px solid var(--rule); border-radius: 3px; padding: 2px;
}
.pc-logo-inicial {
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: 13px; font-weight: 700;
  color: var(--stamp); background: var(--stamp-soft);
  border-color: rgba(108, 63, 168, 0.28);
}
.pc-logo-link { display: inline-flex; border-radius: 3px; }
.pc-logo-link:hover .pc-logo { border-color: var(--stamp); }
.pc-logo-link:focus-visible { outline: 2px solid var(--stamp); outline-offset: 2px; }

/* Observações */
.pc-tr-com-nota td { border-bottom: 0; }
.pc-nota td {
  padding: 0 12px 16px 82px; background: var(--card);
  border-bottom: 1px solid var(--rule); font-size: 14px; color: var(--muted);
  line-height: 1.5; white-space: pre-wrap;
}
.pc-nota-rotulo {
  display: block; font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp);
  margin-bottom: 4px;
}
.pc-cabecalho-pilulas {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-top: 14px;
}
.pc-contagem {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--stamp);
}

/* Pílulas de stack */
.pc-pilulas {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  min-height: 40px; padding: 8px 2px 10px; border-bottom: 1.5px solid var(--rule);
}
.pc-pilulas-vazio { font-size: 14px; color: #A8A59B; }
.pc-pilula {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-mono); font-size: 13px;
  background: var(--stamp-soft); color: var(--stamp);
  border: 1px solid rgba(108, 63, 168, 0.28);
  border-radius: 2px; padding: 5px 6px 5px 10px;
}
.pc-pilula button {
  background: none; border: 0; cursor: pointer; color: inherit;
  font: inherit; line-height: 1; padding: 1px 4px; border-radius: 2px; opacity: .65;
}
.pc-pilula button:hover { opacity: 1; background: rgba(108, 63, 168, 0.16); }
.pc-pilula button:focus-visible { outline: 2px solid var(--stamp); outline-offset: 1px; }
.pc-pilula-manual { background: transparent; border-style: dashed; }
.pc-linha-stack { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; margin-top: 12px; }
.pc-linha-stack .pc-campo { flex: 1 1 220px; }

.pc-rodape-form {
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
  margin-top: 22px; padding-top: 16px; border-top: 1px dashed var(--rule);
}
.pc-btn {
  font-family: var(--font-ui); font-size: 13px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  background: var(--stamp); color: #fff; border: 0; border-radius: 2px;
  padding: 12px 22px; cursor: pointer; transition: transform .12s ease;
}
.pc-btn:hover { transform: translateY(-1px); }
.pc-btn:active { transform: translateY(1px); }
.pc-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.pc-btn-secundario {
  background: transparent; color: var(--stamp);
  border: 1px solid rgba(108, 63, 168, 0.4); padding: 9px 14px; font-size: 12px;
}
.pc-dica { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.pc-erro { font-family: var(--font-mono); font-size: 12px; color: var(--flag); }

.pc-barra {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 12px; margin: 34px 0 10px;
}
.pc-busca {
  font-family: var(--font-mono); font-size: 13px; color: var(--ink);
  background: transparent; border: 1px solid var(--rule); border-radius: 2px;
  padding: 9px 12px; min-width: 240px;
}
.pc-busca:focus { outline: none; border-color: var(--stamp); }
.pc-acoes { display: flex; align-items: center; gap: 14px; }
.pc-link {
  background: none; border: 0; padding: 0; cursor: pointer;
  font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink); border-bottom: 1px solid var(--stamp);
}
.pc-estado {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--muted);
}

.pc-tabela { width: 100%; border-collapse: collapse; }
.pc-tabela th {
  text-align: left; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--muted); font-weight: 600; padding: 10px 12px;
  border-bottom: 1.5px solid var(--ink); white-space: nowrap;
}
.pc-th-btn {
  background: none; border: 0; padding: 0; cursor: pointer; color: inherit;
  font: inherit; letter-spacing: inherit; text-transform: inherit;
}
.pc-tabela td {
  padding: 16px 12px; border-bottom: 1px solid var(--rule);
  font-size: 15px; vertical-align: top; background: var(--card);
}
.pc-tabela tbody tr:hover td { background: #FFFEFB; }
.pc-num { font-family: var(--font-mono); font-size: 12px; color: var(--muted); width: 58px; padding-top: 19px; }
.pc-empresa { font-weight: 600; }
.pc-local, .pc-posicao { color: var(--muted); font-size: 14px; }
.pc-local b { color: var(--ink); font-weight: 600; display: block; font-size: 15px; }
.pc-tags { display: flex; flex-wrap: wrap; gap: 6px; max-width: 260px; }
.pc-etiqueta {
  display: inline-block; font-family: var(--font-mono); font-size: 12px;
  background: var(--stamp-soft); color: var(--stamp); padding: 3px 8px; border-radius: 2px;
}

/* Assinatura da página: o carimbo de protocolo */
.pc-carimbo {
  display: inline-block; border: 2px solid var(--stamp); border-radius: 3px;
  padding: 5px 10px 4px; color: var(--stamp); font-family: var(--font-mono);
  text-align: center; box-shadow: inset 0 0 0 1px var(--stamp); opacity: 0.92;
}
.pc-carimbo .d { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; display: block; }
.pc-carimbo .h {
  font-size: 10px; letter-spacing: 0.14em; display: block;
  border-top: 1px solid var(--stamp); margin-top: 3px; padding-top: 3px;
}
.pc-desde { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-top: 7px; }
.pc-remover {
  background: none; border: 0; cursor: pointer; padding: 4px 0;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
}
.pc-remover:hover, .pc-remover.confirmando { color: var(--flag); }

.pc-vazio {
  border: 1px dashed var(--rule); border-radius: 3px; padding: 48px 24px;
  text-align: center; background: var(--card);
}
.pc-vazio p { margin: 0; color: var(--muted); font-size: 15px; }
.pc-vazio .pc-eyebrow { margin-bottom: 10px; }

@media (max-width: 760px) {
  .pc-tabela thead { display: none; }
  .pc-tabela, .pc-tabela tbody, .pc-tabela tr, .pc-tabela td { display: block; width: 100%; }
  .pc-tabela tr { border: 1px solid var(--rule); border-radius: 3px; margin-bottom: 14px; overflow: hidden; }
  .pc-tabela td { border-bottom: 1px solid var(--rule); padding: 12px 14px; }
  .pc-tabela td:last-child { border-bottom: 0; }
  .pc-tabela td::before {
    content: attr(data-rotulo); display: block; font-family: var(--font-mono);
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 5px;
  }
  .pc-num { width: auto; padding-top: 12px; }
  .pc-tags { max-width: none; }
  .pc-tr-com-nota { margin-bottom: 0; border-bottom: 0; border-radius: 3px 3px 0 0; }
  .pc-nota { display: block; border: 1px solid var(--rule); border-top: 0;
    border-radius: 0 0 3px 3px; margin-bottom: 14px; }
  .pc-nota td { display: block; padding: 12px 14px; border-bottom: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .pc-raiz * { transition: none !important; animation: none !important; }
  .pc-btn:hover { transform: none; }
}
      `}</style>

      <div className="pc-wrap">
        <header className="pc-cabecalho">
          <div>
            <p className="pc-eyebrow">Registro pessoal · atualizado por você</p>
            <h1 className="pc-titulo">Protocolo de candidaturas</h1>
            <p className="pc-sub">
              Cada vaga aplicada recebe um número e um carimbo com a data e hora
              locais do envio.
            </p>
          </div>
          <div className="pc-contadores">
            <div className="pc-contador">
              <b>{String(registros.length).padStart(2, "0")}</b>
              <span>No total</span>
            </div>
            <div className="pc-contador">
              <b>{String(esteMes).padStart(2, "0")}</b>
              <span>Neste mês</span>
            </div>
          </div>
        </header>

        <section className="pc-form">
          <p className="pc-form-titulo">Nova aplicação</p>

          <div className="pc-grade">
            <div className="pc-campo">
              <label htmlFor="pc-empresa">Nome da empresa</label>
              <input
                id="pc-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionar()}
                placeholder="Ex.: Loudly"
              />
            </div>

            <div className="pc-campo">
              <label htmlFor="pc-site">
                Site da empresa
                <span className="pc-dica-inline">opcional — traz o logo</span>
              </label>
              <input
                id="pc-site"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionar()}
                placeholder={
                  empresa ? dominioProvavel(empresa) : "Ex.: loudly.com"
                }
                autoComplete="off"
              />
            </div>

            <div className="pc-campo" ref={blocoCidade}>
              <label htmlFor="pc-cidade">
                Cidade
                {paisDetectado && (
                  <span className="pc-pais-detectado">→ {paisDetectado}</span>
                )}
              </label>
              <input
                id="pc-cidade"
                role="combobox"
                aria-expanded={sugestoesAbertas && sugestoes.length > 0}
                aria-autocomplete="list"
                aria-controls="pc-lista-cidades"
                autoComplete="off"
                value={textoCidade}
                onChange={(e) => {
                  setTextoCidade(e.target.value);
                  setPaisDetectado("");
                  setSugestoesAbertas(true);
                  setIndiceAtivo(0);
                }}
                onFocus={() => setSugestoesAbertas(true)}
                onKeyDown={teclaCidade}
                placeholder="Comece a digitar: Berlim, Lisboa…"
              />
              {sugestoesAbertas && sugestoes.length > 0 && (
                <ul className="pc-sugestoes" id="pc-lista-cidades" role="listbox">
                  {sugestoes.map((item, i) => (
                    <li
                      key={`${item.cidade}-${item.pais}`}
                      role="option"
                      aria-selected={i === indiceAtivo}
                      className="pc-sugestao"
                      onMouseEnter={() => setIndiceAtivo(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        escolherCidade(item);
                      }}
                    >
                      <span>{item.cidade}</span>
                      <span className="pc-sugestao-pais">{item.pais}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pc-campo">
              <label htmlFor="pc-posicao">Posição / cargo</label>
              <input
                id="pc-posicao"
                value={posicao}
                onChange={(e) => setPosicao(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionar()}
                placeholder="Ex.: Senior Frontend Developer"
              />
            </div>

            <div className="pc-campo pc-campo-largo">
              <label htmlFor="pc-descricao">
                Descrição da vaga
                <span className="pc-dica-inline">
                  cole o texto — as tecnologias viram etiquetas sozinhas
                </span>
              </label>
              <textarea
                id="pc-descricao"
                className="pc-textarea"
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Cole aqui os requisitos da vaga. Ex.: You'll work with React, TypeScript and Next.js, with a Node.js/GraphQL backend deployed on AWS…"
              />

              <div className="pc-cabecalho-pilulas">
                <span className="pc-contagem">
                  {stacks.length === 0
                    ? "Nenhuma tecnologia reconhecida"
                    : `${stacks.length} ${
                        stacks.length === 1 ? "tecnologia" : "tecnologias"
                      } na etiqueta`}
                </span>
                {(descricao || manuais.length > 0) && (
                  <button className="pc-link" onClick={limparStacks}>
                    Limpar
                  </button>
                )}
              </div>

              <div className="pc-pilulas">
                {stacks.length === 0 ? (
                  <span className="pc-pilulas-vazio">
                    Cole a descrição acima, ou escreva a tecnologia no campo
                    abaixo.
                  </span>
                ) : (
                  stacks.map((s) => (
                    <span
                      key={s}
                      className={`pc-pilula${
                        manuais.includes(s) && !detectadas.includes(s)
                          ? " pc-pilula-manual"
                          : ""
                      }`}
                    >
                      {s}
                      <button
                        onClick={() => removerStack(s)}
                        aria-label={`Remover ${s}`}
                        title={`Remover ${s}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="pc-linha-stack">
                <div className="pc-campo">
                  <input
                    id="pc-stack-manual"
                    value={stackManual}
                    onChange={(e) => setStackManual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarStack(stackManual);
                        setStackManual("");
                      }
                    }}
                    placeholder="Faltou alguma? Escreva e pressione Enter"
                  />
                </div>
              </div>
            </div>

            <div className="pc-campo pc-campo-largo">
              <label htmlFor="pc-observacoes">
                Observações
                <span className="pc-dica-inline">
                  opcional — recrutador, faixa salarial, link da vaga
                </span>
              </label>
              <textarea
                id="pc-observacoes"
                className="pc-textarea pc-textarea-curto"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: indicação do Pedro · 70–80k · entrevista técnica marcada pra sexta"
              />
            </div>
          </div>

          <div className="pc-rodape-form">
            <button className="pc-btn" onClick={adicionar}>
              Carimbar aplicação
            </button>
            {erro ? (
              <span className="pc-erro">{erro}</span>
            ) : (
              <span className="pc-dica">
                A data e a hora entram sozinhas no momento do registro.
              </span>
            )}
          </div>
        </section>

        <div className="pc-barra">
          <input
            className="pc-busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por empresa, cargo, stack ou cidade"
            aria-label="Buscar candidaturas"
          />
          <div className="pc-acoes">
            <span className="pc-estado">
              {estadoSalvo === "salvando" && "Salvando…"}
              {estadoSalvo === "salvo" && "Salvo"}
              {estadoSalvo === "erro" && "Não foi possível salvar"}
            </span>
            {registros.length > 0 && (
              <button className="pc-link" onClick={exportarCSV}>
                Baixar CSV
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <div className="pc-vazio">
            <p>Abrindo o registro…</p>
          </div>
        ) : visiveis.length === 0 ? (
          <div className="pc-vazio">
            <p className="pc-eyebrow">Registro em branco</p>
            <p>
              {registros.length === 0
                ? "Preencha o formulário acima para carimbar a primeira candidatura."
                : "Nenhuma candidatura corresponde a essa busca."}
            </p>
          </div>
        ) : (
          <table className="pc-tabela">
            <thead>
              <tr>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("numero")}>
                    Nº {seta("numero")}
                  </button>
                </th>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("empresa")}>
                    Empresa {seta("empresa")}
                  </button>
                </th>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("posicao")}>
                    Posição {seta("posicao")}
                  </button>
                </th>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("stack")}>
                    Stack {seta("stack")}
                  </button>
                </th>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("local")}>
                    País / cidade {seta("local")}
                  </button>
                </th>
                <th>
                  <button className="pc-th-btn" onClick={() => ordenarPor("criadoEm")}>
                    Data da aplicação {seta("criadoEm")}
                  </button>
                </th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((r) => {
                const { data, hora } = formatarCarimbo(r.criadoEm);
                return (
                  <React.Fragment key={r.id}>
                  <tr className={r.observacoes ? "pc-tr-com-nota" : ""}>
                    <td className="pc-num" data-rotulo="Nº">
                      {String(r.numero).padStart(3, "0")}
                    </td>
                    <td className="pc-empresa" data-rotulo="Empresa">
                      <span className="pc-empresa-bloco">
                        <LogoEmpresa empresa={r.empresa} site={r.site} />
                        <span>{r.empresa}</span>
                      </span>
                    </td>
                    <td className="pc-posicao" data-rotulo="Posição">
                      {r.posicao}
                    </td>
                    <td data-rotulo="Stack">
                      <div className="pc-tags">
                        {listaDeStacks(r).map((s) => (
                          <span key={s} className="pc-etiqueta">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="pc-local" data-rotulo="País / cidade">
                      {r.cidade ? (
                        <>
                          <b>{r.cidade}</b>
                          {r.pais}
                        </>
                      ) : (
                        r.local
                      )}
                    </td>
                    <td data-rotulo="Data da aplicação">
                      <span className="pc-carimbo">
                        <span className="d">{data}</span>
                        <span className="h">{hora}</span>
                      </span>
                      <span className="pc-desde">{tempoDecorrido(r.criadoEm)}</span>
                    </td>
                    <td data-rotulo="Ações">
                      <button
                        className={`pc-remover${
                          confirmandoRemocao === r.id ? " confirmando" : ""
                        }`}
                        onClick={() => remover(r.id)}
                      >
                        {confirmandoRemocao === r.id ? "Confirmar" : "Remover"}
                      </button>
                    </td>
                  </tr>
                  {r.observacoes && (
                    <tr className="pc-nota">
                      <td colSpan={7}>
                        <span className="pc-nota-rotulo">Observações</span>
                        {r.observacoes}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
