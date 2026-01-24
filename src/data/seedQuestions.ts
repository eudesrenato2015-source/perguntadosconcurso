import type { Discipline, ExamStyle, Question, QType } from "../types";

type OptionKey = "A"|"B"|"C"|"D"|"E";

type Option = { key: OptionKey; text: string };

type Choice = { text: string; reason: string };

type MCQChoice = { text: string; correct?: boolean; why?: string };

type TemplateBuild = {
  statement: string;
  options: Option[];
  correctKey: OptionKey;
  explanation: Question["explanation"];
};

type TemplateCtx = {
  rng: () => number;
  discipline: Discipline;
  subject: string;
  topic: string;
  difficulty: 1|2|3|4|5;
};

type Template = {
  id: string;
  discipline: Discipline;
  subject: string;
  topic: string;
  type: QType;
  difficulty: 1|2|3|4|5;
  styles?: ExamStyle[];
  make: (ctx: TemplateCtx) => TemplateBuild;
};

const OPTION_KEYS: OptionKey[] = ["A","B","C","D","E"];

const mcqStyles: ExamStyle[] = ["FGV","VUNESP","FCC","IBFC","QUADRIX","AOCP"];
const tfStyles: ExamStyle[] = ["CEBRASPE","CESPE"];

const defaultStems = [
  "Assinale a alternativa correta sobre {topic}.",
  "Em {topic}, é correto afirmar que:",
  "No tema {topic}, assinale a opção correta.",
  "A respeito de {topic}, assinale a alternativa correta."
];

const defaultCorrectReasons = [
  "Afirmação alinhada à regra central do tema.",
  "O enunciado respeita os requisitos e exceções do tópico.",
  "A assertiva segue o entendimento predominante nas bancas."
];

const defaultWrongReasons = [
  "Generaliza indevidamente ou ignora exceções relevantes.",
  "Confunde conceitos próximos ou aplica regra diversa.",
  "Contraria a literalidade/entendimento consolidado do tema."
];

function mulberry32(a: number){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string){
  let h = 2166136261;
  for (let i=0;i<input.length;i++){
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: ()=>number, arr: T[]): T{
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: ()=>number, arr: T[]): T[]{
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickMany<T>(rng: ()=>number, arr: T[], n: number): T[]{
  return shuffle(rng, arr).slice(0, Math.min(n, arr.length));
}

function toChoices(texts: string[], reasons: string[] = defaultCorrectReasons): Choice[]{
  return texts.map((text, i) => ({ text, reason: reasons[i % reasons.length] }));
}

function buildMCQOptions(rng: ()=>number, choices: MCQChoice[]): { options: Option[]; correctKey: OptionKey; whyWrong: Partial<Record<OptionKey, string>> }{
  const shuffled = shuffle(rng, choices);
  let correctIndex = shuffled.findIndex(item => item.correct);
  if (correctIndex < 0) correctIndex = 0;
  const options = shuffled.map((item, idx) => ({ key: OPTION_KEYS[idx], text: item.text }));
  const whyWrong: Partial<Record<OptionKey, string>> = {};
  shuffled.forEach((item, idx) => {
    if (!item.correct && item.why){
      whyWrong[OPTION_KEYS[idx]] = item.why;
    }
  });
  return { options, correctKey: OPTION_KEYS[correctIndex], whyWrong };
}

function buildTFOptions(isTrue: boolean): { options: Option[]; correctKey: OptionKey; whyWrong: Partial<Record<OptionKey, string>> }{
  const options: Option[] = [
    { key: "A", text: "Certo" },
    { key: "B", text: "Errado" },
    { key: "C", text: "-" },
    { key: "D", text: "-" },
    { key: "E", text: "-" }
  ];
  const correctKey: OptionKey = isTrue ? "A" : "B";
  const whyWrong: Partial<Record<OptionKey, string>> = {};
  whyWrong[isTrue ? "B" : "A"] = isTrue
    ? "A alternativa 'Errado' contraria o enunciado verdadeiro."
    : "A alternativa 'Certo' contraria o enunciado falso.";
  return { options, correctKey, whyWrong };
}

function mcqFromPools(
  rng: ()=>number,
  statement: string,
  correctPool: Choice[],
  wrongPool: Choice[],
  summary: string,
  tips: string[]
): TemplateBuild{
  const correct = pick(rng, correctPool);
  const wrongs = pickMany(rng, wrongPool, 4);
  const choices: MCQChoice[] = [
    { text: correct.text, correct: true },
    ...wrongs.map(item => ({ text: item.text, why: item.reason }))
  ];
  const { options, correctKey, whyWrong } = buildMCQOptions(rng, choices);
  return {
    statement,
    options,
    correctKey,
    explanation: {
      summary,
      whyCorrect: correct.reason,
      whyWrong,
      tips
    }
  };
}

function buildTFQuestion(
  statement: string,
  isTrue: boolean,
  whyCorrect: string,
  summary: string,
  tips: string[]
): TemplateBuild{
  const { options, correctKey, whyWrong } = buildTFOptions(isTrue);
  return {
    statement,
    options,
    correctKey,
    explanation: {
      summary,
      whyCorrect,
      whyWrong,
      tips
    }
  };
}

function makeStem(rng: ()=>number, topic: string, stems = defaultStems){
  return pick(rng, stems).replace("{topic}", topic);
}

function makeMCQTemplate(cfg: {
  id: string;
  discipline: Discipline;
  subject: string;
  topic: string;
  difficulty: 1|2|3|4|5;
  styles?: ExamStyle[];
  correctTexts: string[];
  wrongTexts: string[];
  summary: string;
  tips: string[];
  correctReasons?: string[];
  wrongReasons?: string[];
  stems?: string[];
}): Template{
  const correctPool = toChoices(cfg.correctTexts, cfg.correctReasons ?? defaultCorrectReasons);
  const wrongPool = toChoices(cfg.wrongTexts, cfg.wrongReasons ?? defaultWrongReasons);
  return {
    id: cfg.id,
    discipline: cfg.discipline,
    subject: cfg.subject,
    topic: cfg.topic,
    type: "MCQ",
    difficulty: cfg.difficulty,
    styles: cfg.styles,
    make: ({ rng }) => {
      const statement = makeStem(rng, cfg.topic, cfg.stems);
      return mcqFromPools(rng, statement, correctPool, wrongPool, cfg.summary, cfg.tips);
    }
  };
}

function makeTFTemplate(cfg: {
  id: string;
  discipline: Discipline;
  subject: string;
  topic: string;
  difficulty: 1|2|3|4|5;
  styles?: ExamStyle[];
  trueTexts: string[];
  falseTexts: string[];
  summary: string;
  tips: string[];
  stems?: string[];
}): Template{
  return {
    id: cfg.id,
    discipline: cfg.discipline,
    subject: cfg.subject,
    topic: cfg.topic,
    type: "TF",
    difficulty: cfg.difficulty,
    styles: cfg.styles,
    make: ({ rng }) => {
      const isTrue = rng() < 0.5;
      const raw = isTrue ? pick(rng, cfg.trueTexts) : pick(rng, cfg.falseTexts);
      const statement = raw.replace("{topic}", cfg.topic);
      const whyCorrect = isTrue
        ? "A assertiva está de acordo com a regra do tema."
        : "A assertiva contraria requisito ou exceção do tema.";
      return buildTFQuestion(statement, isTrue, whyCorrect, cfg.summary, cfg.tips);
    }
  };
}

function varyDifficulty(base: 1|2|3|4|5, rng: ()=>number): 1|2|3|4|5{
  const roll = rng();
  let next = base;
  if (roll < 0.15) next = Math.max(1, base - 1) as 1|2|3|4|5;
  else if (roll > 0.85) next = Math.min(5, base + 1) as 1|2|3|4|5;
  return next;
}

function slugify(input: string){
  const clean = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function generateFromTemplate(t: Template, count: number): Question[]{
  const out: Question[] = [];
  for (let i=0;i<count;i++){
    const seed = hashString(`${t.id}::${i}`);
    const rng = mulberry32(seed);
    const diff = varyDifficulty(t.difficulty, rng);
    const styles = t.styles ?? (t.type === "TF" ? tfStyles : mcqStyles);
    const style = pick(rng, styles);
    const built = t.make({ rng, discipline: t.discipline, subject: t.subject, topic: t.topic, difficulty: diff });
    out.push({
      id: `seed-${slugify(t.discipline)}-${slugify(t.id)}-${i}`,
      discipline: t.discipline,
      subject: t.subject,
      topic: t.topic,
      difficulty: diff,
      type: t.type,
      style,
      statement: built.statement,
      options: built.options,
      correctKey: built.correctKey,
      explanation: built.explanation
    });
  }
  return out;
}

const templates: Template[] = [
  // Português
  makeMCQTemplate({
    id: "port-crase",
    discipline: "Português",
    subject: "Crase",
    topic: "crase",
    difficulty: 3,
    styles: ["FGV","FCC","VUNESP"],
    summary: "A crase resulta da fusão de preposição 'a' com artigo/ pronome demonstrativo.",
    tips: [
      "Teste do masculino: se vira 'ao', há crase no feminino.",
      "Locuções adverbiais femininas geralmente exigem crase.",
      "Antes de pronomes pessoais e de 'cada', a crase é proibida."
    ],
    correctTexts: [
      "Há crase com pronomes demonstrativos: 'referiu-se àquela norma'.",
      "Em locuções adverbiais femininas, a crase é, em regra, obrigatória.",
      "Antes de horas determinadas ocorre crase: 'às 18h'.",
      "Topônimos com artigo feminino admitem crase: 'à Bahia', 'à França'.",
      "A expressão 'à medida que' exige crase por ser locução conjuntiva."
    ],
    wrongTexts: [
      "Há crase antes de palavras masculinas como 'a prazo' e 'a pé'.",
      "A crase é obrigatória antes de 'todos' e 'cada'.",
      "Topônimos sem artigo admitem crase obrigatória: 'à Roma'.",
      "Antes de pronomes pessoais (ela, você) deve-se usar crase.",
      "A locução 'a partir de' exige crase."
    ]
  }),
  makeMCQTemplate({
    id: "port-concord",
    discipline: "Português",
    subject: "Concordância",
    topic: "concordância verbal",
    difficulty: 3,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Concordância verbal depende do núcleo do sujeito e de regras especiais (verbos impessoais).",
    tips: [
      "Verbos impessoais (haver, fazer tempo) ficam no singular.",
      "Expressões como 'mais de um' tendem ao singular.",
      "Com 'quem', costuma-se usar o singular."
    ],
    correctTexts: [
      "Houve dezenas de chamados durante o plantão.",
      "Faz três anos que o edital foi publicado.",
      "Mais de um candidato foi eliminado.",
      "Fui eu quem elaborei o relatório.",
      "Nenhum dos suspeitos foi localizado."
    ],
    wrongTexts: [
      "Houveram dezenas de chamados durante o plantão.",
      "Fazem três anos que o edital foi publicado.",
      "Mais de um candidato foram eliminados.",
      "Fui eu quem elaboramos o relatório.",
      "Nenhum dos suspeitos foram localizados."
    ]
  }),
  makeMCQTemplate({
    id: "port-regencia",
    discipline: "Português",
    subject: "Regência e colocação",
    topic: "regência e colocação pronominal",
    difficulty: 4,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Regência define preposições exigidas e colocação pronominal obedece fatores de atração.",
    tips: [
      "Após palavras negativas, usa-se próclise.",
      "'Assistir' no sentido de ver exige preposição a.",
      "'Preferir' pede 'X a Y', sem 'mais...do que'."
    ],
    correctTexts: [
      "O agente assistiu ao vídeo da ocorrência.",
      "Preferiu o turno da noite ao da manhã.",
      "Obedeceu às normas internas do setor.",
      "Não me entregaram o relatório no prazo.",
      "Foi a norma a que se referiu o parecer."
    ],
    wrongTexts: [
      "O agente assistiu o vídeo da ocorrência.",
      "Preferiu mais o turno da noite do que o da manhã.",
      "Obedeceu as normas internas do setor.",
      "Não entregaram-me o relatório no prazo.",
      "Foi a norma que se referiu o parecer."
    ]
  }),
  makeMCQTemplate({
    id: "port-pontuacao",
    discipline: "Português",
    subject: "Pontuação",
    topic: "pontuação",
    difficulty: 3,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Pontuação marca relações sintáticas e semânticas; vírgulas indevidas geram erro.",
    tips: [
      "Evite separar sujeito e verbo por vírgula.",
      "Orações explicativas são isoladas por vírgulas.",
      "Adjuntos deslocados podem vir entre vírgulas."
    ],
    correctTexts: [
      "Não se separa sujeito do verbo por vírgula.",
      "Orações explicativas costumam ser isoladas por vírgulas.",
      "Adjunto adverbial deslocado pode ser isolado por vírgulas.",
      "Antes de 'mas', a vírgula costuma ser usada.",
      "Elementos enumerados são separados por vírgulas."
    ],
    wrongTexts: [
      "A vírgula é obrigatória entre verbo e complemento.",
      "Orações restritivas devem ser sempre isoladas por vírgulas.",
      "Nunca se usa vírgula antes de 'mas'.",
      "A vírgula é obrigatória entre sujeito simples e verbo.",
      "A vírgula separa sempre nome e adjunto adnominal."
    ]
  }),
  makeTFTemplate({
    id: "port-interpretacao",
    discipline: "Português",
    subject: "Interpretação",
    topic: "interpretação e coesão",
    difficulty: 3,
    styles: ["CEBRASPE","CESPE"],
    summary: "Interpretação exige considerar coesão, coerência e pistas textuais.",
    tips: [
      "Evite extrapolações sem apoio textual.",
      "Conectivos organizam a progressão das ideias.",
      "Contexto e gênero orientam o sentido."
    ],
    trueTexts: [
      "Inferências válidas devem se apoiar em indícios do texto.",
      "Conectivos indicam relações lógicas relevantes para o sentido global.",
      "A coerência depende da articulação entre ideias e progressão textual.",
      "O contexto pode alterar o sentido de palavras polissêmicas."
    ],
    falseTexts: [
      "A interpretação deve ignorar o contexto e focar apenas no sentido literal.",
      "Conectivos não influenciam o sentido do texto.",
      "Extrapolar fatos não mencionados é aceitável se parecer provável.",
      "Inferências podem ser feitas sem qualquer indício textual."
    ]
  }),

  // Constitucional
  makeMCQTemplate({
    id: "const-direitos",
    discipline: "Constitucional",
    subject: "Direitos Fundamentais",
    topic: "direitos fundamentais",
    difficulty: 4,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Direitos fundamentais não são absolutos e admitem restrições proporcionais.",
    tips: [
      "Cláusulas pétreas não podem ser abolidas por emenda.",
      "Aplicação imediata não elimina a necessidade de regulamentação.",
      "Direitos sociais possuem exigibilidade, ainda que gradual."
    ],
    correctTexts: [
      "Direitos fundamentais admitem limitações proporcionais e legais.",
      "Cláusulas pétreas não podem ser abolidas por emenda constitucional.",
      "Direitos fundamentais possuem aplicação imediata, com eficácia variável.",
      "Tratados de DH aprovados pelo rito qualificado têm status de emenda.",
      "A restrição de direitos deve respeitar proporcionalidade e razoabilidade."
    ],
    wrongTexts: [
      "Direitos fundamentais são absolutos e intangíveis.",
      "Cláusulas pétreas podem ser abolidas por lei complementar.",
      "Direitos fundamentais só se aplicam nas relações Estado-cidadão.",
      "Aplicação imediata impede qualquer restrição legislativa.",
      "Direitos sociais não possuem eficácia jurídica."
    ]
  }),
  makeMCQTemplate({
    id: "const-competencias",
    discipline: "Constitucional",
    subject: "Organização do Estado",
    topic: "competências constitucionais",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Competências podem ser privativas, comuns ou concorrentes, com efeitos distintos.",
    tips: [
      "Competência comum é administrativa (executiva).",
      "Na concorrente, a União edita normas gerais.",
      "Matérias penais são privativas da União."
    ],
    correctTexts: [
      "Competência comum é administrativa, não legislativa.",
      "Na competência concorrente, a União edita normas gerais.",
      "Estados podem suplementar normas gerais federais.",
      "Direito penal é matéria de competência privativa da União.",
      "Municípios legislam sobre interesse local."
    ],
    wrongTexts: [
      "Competência comum autoriza legislar amplamente sobre a matéria.",
      "Na concorrente, os estados editam normas gerais e a União suplementa.",
      "Direito penal é matéria de competência municipal.",
      "Estados não podem suplementar normas gerais federais.",
      "Municípios têm competência legislativa irrestrita."
    ]
  }),
  makeMCQTemplate({
    id: "const-poderes",
    discipline: "Constitucional",
    subject: "Poderes",
    topic: "separação de poderes",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Separação de poderes admite freios e contrapesos, com controle recíproco.",
    tips: [
      "Controle judicial incide sobre legalidade e constitucionalidade.",
      "Iniciativa legislativa pode ser privativa em alguns casos.",
      "Independência não exclui cooperação entre poderes."
    ],
    correctTexts: [
      "A separação de poderes admite sistema de freios e contrapesos.",
      "O Judiciário pode controlar a legalidade de atos administrativos.",
      "A iniciativa de certas leis é privativa do Executivo.",
      "A independência dos poderes não exclui o controle recíproco.",
      "O veto presidencial é mecanismo típico de freio e contrapeso."
    ],
    wrongTexts: [
      "O Judiciário não pode controlar atos administrativos em hipótese alguma.",
      "A separação de poderes impede qualquer controle recíproco.",
      "O veto presidencial pode ser exercido pelo Judiciário.",
      "A iniciativa legislativa é sempre concorrente entre os poderes.",
      "Independência significa ausência total de cooperação institucional."
    ]
  }),
  makeMCQTemplate({
    id: "const-controle",
    discipline: "Constitucional",
    subject: "Controle de Constitucionalidade",
    topic: "controle de constitucionalidade",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "O controle pode ser difuso ou concentrado, com efeitos distintos.",
    tips: [
      "No difuso, o controle ocorre em caso concreto.",
      "No concentrado, há efeitos erga omnes e vinculantes.",
      "A modulação de efeitos exige quórum qualificado."
    ],
    correctTexts: [
      "No controle difuso, qualquer juiz pode afastar a norma no caso concreto.",
      "No controle concentrado, a decisão tem efeitos erga omnes.",
      "ADI é cabível contra lei ou ato normativo federal ou estadual.",
      "A modulação de efeitos no STF exige maioria qualificada.",
      "Controle concentrado gera efeito vinculante para o Judiciário e a Administração."
    ],
    wrongTexts: [
      "Controle difuso gera automaticamente efeitos erga omnes.",
      "ADC é cabível contra ato municipal.",
      "ADI pode ser proposta para qualquer ato administrativo individual.",
      "A modulação de efeitos exige maioria simples.",
      "Controle concentrado só produz efeitos inter partes."
    ]
  }),
  makeTFTemplate({
    id: "const-processo-leg",
    discipline: "Constitucional",
    subject: "Processo Legislativo",
    topic: "processo legislativo",
    difficulty: 4,
    styles: ["CEBRASPE","CESPE"],
    summary: "O processo legislativo possui quóruns e etapas específicos.",
    tips: [
      "Lei complementar exige maioria absoluta.",
      "Emendas constitucionais exigem 3/5 em dois turnos.",
      "MP perde eficácia se não convertida."
    ],
    trueTexts: [
      "Lei complementar exige maioria absoluta para aprovação.",
      "Emenda constitucional exige três quintos em dois turnos em cada Casa.",
      "Medida provisória perde eficácia se não convertida em lei em até 120 dias.",
      "Projeto de lei ordinária exige maioria simples, salvo disposição diversa."
    ],
    falseTexts: [
      "Lei ordinária exige maioria absoluta em qualquer hipótese.",
      "Medida provisória pode tratar de direito penal.",
      "Emenda constitucional é aprovada por maioria simples em turno único.",
      "Medida provisória pode ser editada para matéria reservada a lei complementar."
    ]
  }),

  // Administrativo
  makeMCQTemplate({
    id: "adm-atos",
    discipline: "Administrativo",
    subject: "Atos Administrativos",
    topic: "atos administrativos",
    difficulty: 4,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Atos administrativos possuem requisitos e atributos próprios.",
    tips: [
      "Anulação é por ilegalidade; revogação é por conveniência.",
      "Presunção de legitimidade admite prova em contrário.",
      "Nem todo ato é autoexecutório."
    ],
    correctTexts: [
      "A anulação decorre de ilegalidade e pode ser feita pela Administração ou Judiciário.",
      "A revogação decorre de conveniência e oportunidade.",
      "A presunção de legitimidade admite prova em contrário.",
      "A autoexecutoriedade depende de previsão legal ou urgência.",
      "A teoria dos motivos determinantes vincula a Administração aos motivos declarados."
    ],
    wrongTexts: [
      "A revogação é medida para sanar ilegalidade do ato.",
      "A anulação só pode ser feita pelo Judiciário.",
      "Todo ato administrativo é autoexecutório.",
      "A convalidação é possível mesmo quando há objeto ilícito.",
      "Presunção de legitimidade é absoluta e irreversível."
    ]
  }),
  makeMCQTemplate({
    id: "adm-poderes",
    discipline: "Administrativo",
    subject: "Poderes Administrativos",
    topic: "poderes administrativos",
    difficulty: 4,
    styles: ["FGV","FCC","VUNESP"],
    summary: "Poderes administrativos permitem atuação vinculada e discricionária dentro da lei.",
    tips: [
      "Poder de polícia limita direitos em prol do interesse público.",
      "Poder hierárquico permite delegar e avocar competências.",
      "Regulamentos não podem inovar na ordem jurídica."
    ],
    correctTexts: [
      "O poder de polícia limita direitos individuais em benefício do interesse público.",
      "O poder hierárquico permite delegar e avocar competências.",
      "O poder disciplinar incide sobre servidores e particulares sujeitos à Administração.",
      "O poder regulamentar visa dar fiel execução à lei.",
      "Poderes administrativos devem observar legalidade e proporcionalidade."
    ],
    wrongTexts: [
      "O poder regulamentar permite inovar livremente na ordem jurídica.",
      "O poder hierárquico inexiste entre órgãos da mesma pessoa jurídica.",
      "O poder de polícia cria direitos subjetivos sem base legal.",
      "O poder disciplinar só alcança servidores estáveis.",
      "A Administração pode exercer poder de polícia sem controle judicial."
    ]
  }),
  makeMCQTemplate({
    id: "adm-licitacoes",
    discipline: "Administrativo",
    subject: "Licitações e Contratos",
    topic: "licitações e contratos",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Licitação é regra; dispensa e inexigibilidade são exceções legais.",
    tips: [
      "Inexigibilidade ocorre quando a competição é inviável.",
      "Dispensa depende de hipóteses legais expressas.",
      "Pregão é modalidade para bens e serviços comuns."
    ],
    correctTexts: [
      "Inexigibilidade ocorre quando a competição é inviável.",
      "Dispensa só é possível nas hipóteses legais expressas.",
      "Pregão é utilizado para bens e serviços comuns.",
      "A licitação busca isonomia e seleção da proposta mais vantajosa.",
      "A contratação direta exige motivação e justificativa."
    ],
    wrongTexts: [
      "Inexigibilidade ocorre por mera conveniência administrativa.",
      "A dispensa é regra e a licitação exceção.",
      "Pregão é modalidade exclusiva para obras e serviços de engenharia.",
      "A contratação direta independe de motivação.",
      "A licitação busca apenas o menor preço, sem outros critérios."
    ]
  }),
  makeMCQTemplate({
    id: "adm-agentes",
    discipline: "Administrativo",
    subject: "Agentes Públicos",
    topic: "agentes públicos",
    difficulty: 4,
    styles: ["FGV","FCC","VUNESP"],
    summary: "O regime jurídico dos agentes públicos obedece a regras constitucionais.",
    tips: [
      "Concurso é regra para provimento efetivo.",
      "Estabilidade após 3 anos e avaliação.",
      "Acumulação é exceção constitucional."
    ],
    correctTexts: [
      "O concurso público é regra para provimento de cargo efetivo.",
      "Estabilidade exige três anos de efetivo exercício e avaliação.",
      "A acumulação de cargos é exceção e depende de compatibilidade de horários.",
      "Servidor estável pode perder o cargo em hipóteses constitucionais.",
      "Emprego público é regido pela CLT, em regra."
    ],
    wrongTexts: [
      "A estabilidade é adquirida imediatamente após a posse.",
      "A acumulação de cargos é livre, salvo vedação expressa.",
      "Concurso público é exigência apenas para cargos comissionados.",
      "Servidor estável não pode perder o cargo em nenhuma hipótese.",
      "Emprego público é sempre regido por estatuto próprio."
    ]
  }),
  makeTFTemplate({
    id: "adm-responsabilidade",
    discipline: "Administrativo",
    subject: "Responsabilidade Civil do Estado",
    topic: "responsabilidade civil do Estado",
    difficulty: 4,
    styles: ["CEBRASPE","CESPE"],
    summary: "A responsabilidade estatal, em regra, é objetiva (risco administrativo).",
    tips: [
      "Excludentes: culpa exclusiva da vítima, caso fortuito externo.",
      "Há direito de regresso contra o agente com dolo/culpa.",
      "Omissão pode exigir prova de culpa (em regra)."
    ],
    trueTexts: [
      "A responsabilidade do Estado é objetiva, baseada no risco administrativo.",
      "Há direito de regresso contra o agente que agir com dolo ou culpa.",
      "Culpa exclusiva da vítima pode afastar a responsabilidade do Estado.",
      "Na omissão específica, costuma-se exigir prova de culpa."
    ],
    falseTexts: [
      "A responsabilidade do Estado é sempre subjetiva.",
      "Culpa concorrente elimina totalmente o dever de indenizar.",
      "O Estado nunca responde por atos de seus agentes.",
      "Não existe direito de regresso contra o agente público."
    ]
  }),

  // Penal/Proc Penal
  makeMCQTemplate({
    id: "penal-teoria",
    discipline: "Penal/Proc Penal",
    subject: "Teoria do Crime",
    topic: "teoria do crime",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "O crime exige tipicidade, ilicitude e culpabilidade, com elementos subjetivos.",
    tips: [
      "Erro de tipo exclui dolo e pode excluir culpa.",
      "Excludentes de ilicitude afastam o crime.",
      "Dolo eventual difere de culpa consciente."
    ],
    correctTexts: [
      "Erro de tipo exclui o dolo e pode excluir a culpa.",
      "Excludentes de ilicitude afastam a antijuridicidade.",
      "Culpabilidade envolve imputabilidade, potencial consciência e exigibilidade.",
      "Dolo eventual assume o risco do resultado.",
      "Culpa exige violação de dever objetivo de cuidado."
    ],
    wrongTexts: [
      "Erro de tipo exclui a ilicitude, mas mantém o dolo.",
      "Excludente de ilicitude elimina a tipicidade do fato.",
      "Culpabilidade e tipicidade são sinônimos.",
      "Dolo eventual e culpa consciente são idênticos.",
      "Culpa dispensa violação de dever objetivo de cuidado."
    ]
  }),
  makeMCQTemplate({
    id: "penal-concurso",
    discipline: "Penal/Proc Penal",
    subject: "Concurso de Pessoas",
    topic: "concurso de pessoas",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "No concurso de pessoas, em regra, aplica-se a teoria monista.",
    tips: [
      "A participação pressupõe fato típico e ilícito principal.",
      "O concurso exige liame subjetivo.",
      "Há diferenciação entre autor e partícipe."
    ],
    correctTexts: [
      "Pela teoria monista, todos respondem pelo mesmo crime, com penas individualizadas.",
      "A participação pressupõe crime principal típico e ilícito.",
      "É necessário liame subjetivo entre os agentes.",
      "Instigação e auxílio configuram formas de participação.",
      "A autoria pode ser direta, mediata ou coautoria."
    ],
    wrongTexts: [
      "Pela teoria dualista, a regra é separar sempre autor e partícipe em crimes distintos.",
      "Participação é punível mesmo sem fato principal típico e ilícito.",
      "Concurso de pessoas dispensa liame subjetivo.",
      "Instigação e auxílio não são puníveis no Brasil.",
      "Autoria mediata é sempre impossível."
    ]
  }),
  makeMCQTemplate({
    id: "penal-penas",
    discipline: "Penal/Proc Penal",
    subject: "Penas",
    topic: "penas e dosimetria",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "A dosimetria segue o sistema trifásico e regras específicas.",
    tips: [
      "Sistema trifásico: base, agravantes/atenuantes, causas de aumento/diminuição.",
      "Substituição exige requisitos legais.",
      "Regime inicial depende da pena e reincidência."
    ],
    correctTexts: [
      "A dosimetria segue o sistema trifásico do art. 68 do CP.",
      "A substituição por restritivas de direitos depende de requisitos legais.",
      "O regime inicial considera a quantidade de pena e a reincidência.",
      "A suspensão condicional da pena exige pena não superior a 2 anos, em regra.",
      "As causas de aumento/diminuição incidem na terceira fase."
    ],
    wrongTexts: [
      "A dosimetria ocorre em duas fases apenas.",
      "Substituição da pena é automática para qualquer crime.",
      "Regime inicial independe da pena aplicada.",
      "Sursis é cabível para pena de até 6 anos.",
      "Agravantes e atenuantes são aplicadas na terceira fase."
    ]
  }),
  makeMCQTemplate({
    id: "penal-acao",
    discipline: "Penal/Proc Penal",
    subject: "Ação Penal",
    topic: "ação penal",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "A ação penal pode ser pública ou privada, conforme previsão legal.",
    tips: [
      "A regra é ação pública incondicionada.",
      "A ação pública condicionada depende de representação.",
      "A queixa está sujeita à decadência."
    ],
    correctTexts: [
      "A ação penal pública incondicionada é regra.",
      "A ação pública condicionada depende de representação do ofendido.",
      "A ação privada depende de queixa do ofendido.",
      "O prazo decadencial para queixa é de 6 meses.",
      "A representação pode ser retratada antes do oferecimento da denúncia."
    ],
    wrongTexts: [
      "A ação penal pública condicionada depende de autorização judicial.",
      "A ação privada dispensa queixa formal.",
      "O prazo decadencial para queixa é de 2 anos.",
      "A representação é irretratável em qualquer fase.",
      "A regra é ação penal privada."
    ]
  }),
  makeTFTemplate({
    id: "penal-provas",
    discipline: "Penal/Proc Penal",
    subject: "Provas e Prisão",
    topic: "provas e prisão cautelar",
    difficulty: 4,
    styles: ["CEBRASPE","CESPE"],
    summary: "Provas ilícitas são inadmissíveis e prisão cautelar exige requisitos.",
    tips: [
      "Prisão preventiva exige fumus comissi delicti e periculum libertatis.",
      "Provas ilícitas devem ser desentranhadas.",
      "Flagrante tem hipóteses legais específicas."
    ],
    trueTexts: [
      "Provas ilícitas são inadmissíveis no processo penal.",
      "Prisão preventiva exige requisitos legais e fundamentação.",
      "A cadeia de custódia visa preservar a confiabilidade da prova.",
      "A prisão em flagrante possui hipóteses taxativas em lei."
    ],
    falseTexts: [
      "Prisão preventiva é automática após denúncia.",
      "Provas ilícitas podem ser usadas livremente se úteis.",
      "Cadeia de custódia é irrelevante para a validade da prova.",
      "Flagrante pode ser decretado sem situação típica."
    ]
  }),

  // Direitos Humanos / Criminologia
  makeMCQTemplate({
    id: "dh-tratados",
    discipline: "DH/Criminologia",
    subject: "Tratados de DH",
    topic: "tratados de direitos humanos",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Tratados de DH podem ter status constitucional ou supralegal, conforme rito.",
    tips: [
      "Rito qualificado: status de emenda constitucional.",
      "Rito ordinário: supralegal (STF).",
      "Necessitam de aprovação e internalização."
    ],
    correctTexts: [
      "Tratado de DH aprovado pelo rito qualificado tem status de emenda.",
      "Tratado de DH aprovado pelo rito ordinário possui status supralegal.",
      "Tratados exigem aprovação do Congresso e promulgação.",
      "O Brasil pode reconhecer a jurisdição da Corte IDH.",
      "Tratados não podem contrariar cláusulas pétreas."
    ],
    wrongTexts: [
      "Todo tratado tem status constitucional, independentemente do rito.",
      "Tratados de DH possuem status de lei ordinária apenas.",
      "Tratados dispensam aprovação do Congresso Nacional.",
      "A Corte IDH possui jurisdição automática sem reconhecimento.",
      "Tratados podem revogar cláusulas pétreas."
    ]
  }),
  makeMCQTemplate({
    id: "dh-convencionalidade",
    discipline: "DH/Criminologia",
    subject: "Controle de Convencionalidade",
    topic: "controle de convencionalidade",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "O controle de convencionalidade verifica compatibilidade com tratados de DH.",
    tips: [
      "Juízes nacionais podem aplicar controle de convencionalidade.",
      "A Corte IDH exerce controle internacional.",
      "Interpretação conforme tratados é recomendada."
    ],
    correctTexts: [
      "Juízes nacionais podem deixar de aplicar norma incompatível com tratado de DH.",
      "A Corte IDH realiza controle internacional de convencionalidade.",
      "O controle busca compatibilizar normas internas com tratados.",
      "A interpretação conforme tratados é instrumento preferencial.",
      "O controle de convencionalidade complementa o controle de constitucionalidade."
    ],
    wrongTexts: [
      "Apenas o STF pode exercer controle de convencionalidade.",
      "Controle de convencionalidade substitui totalmente o controle constitucional.",
      "Normas internas incompatíveis com tratados devem sempre prevalecer.",
      "A Corte IDH não possui competência para controle algum.",
      "A interpretação conforme tratados é vedada."
    ]
  }),
  makeMCQTemplate({
    id: "dh-uso-forca",
    discipline: "DH/Criminologia",
    subject: "Uso da Força",
    topic: "uso proporcional da força",
    difficulty: 3,
    styles: ["FGV","VUNESP","FCC"],
    summary: "O uso da força deve observar legalidade, necessidade e proporcionalidade.",
    tips: [
      "Força letal é medida extrema.",
      "Deve-se avaliar progressividade e necessidade.",
      "A atuação deve ser registrada e justificada."
    ],
    correctTexts: [
      "O uso da força deve respeitar legalidade, necessidade e proporcionalidade.",
      "Força letal só se justifica em situações extremas.",
      "A progressividade do uso da força é regra.",
      "A intervenção deve ser adequada ao risco presente.",
      "O uso da força exige registro e accountability."
    ],
    wrongTexts: [
      "Força letal é a primeira opção em situações de conflito.",
      "A necessidade dispensa avaliação de proporcionalidade.",
      "Uso da força pode ser aplicado sem justificativa posterior.",
      "A progressividade é irrelevante em abordagens rotineiras.",
      "A atuação policial não está sujeita a controle externo."
    ]
  }),
  makeMCQTemplate({
    id: "dh-criminologia",
    discipline: "DH/Criminologia",
    subject: "Criminologia",
    topic: "teorias criminológicas",
    difficulty: 3,
    styles: ["FGV","VUNESP","FCC"],
    summary: "As teorias criminológicas explicam o crime por diferentes perspectivas.",
    tips: [
      "Clássica: livre-arbítrio e racionalidade.",
      "Positivista: fatores biológicos/sociais.",
      "Crítica: seletividade e rotulação."
    ],
    correctTexts: [
      "A escola clássica enfatiza o livre-arbítrio e a racionalidade.",
      "A escola positivista associa crime a fatores biológicos e sociais.",
      "A criminologia crítica destaca a seletividade do sistema penal.",
      "A teoria do etiquetamento analisa a rotulação social.",
      "A prevenção pode ser situacional ou social, conforme a abordagem."
    ],
    wrongTexts: [
      "A escola clássica defende determinismo biológico.",
      "A criminologia crítica nega qualquer seletividade penal.",
      "A teoria do etiquetamento ignora o impacto social da rotulação.",
      "A prevenção social se resume ao aumento de penas.",
      "A criminologia positivista rejeita a influência social no crime."
    ]
  }),
  makeTFTemplate({
    id: "dh-execucao",
    discipline: "DH/Criminologia",
    subject: "Execução Penal",
    topic: "execução penal e direitos do preso",
    difficulty: 3,
    styles: ["CEBRASPE","CESPE"],
    summary: "A execução penal visa ressocialização e proteção de direitos básicos.",
    tips: [
      "Progressão depende de requisitos objetivos e subjetivos.",
      "Direitos do preso são garantidos pela Constituição e LEP.",
      "Individualização é princípio central."
    ],
    trueTexts: [
      "A progressão de regime depende de requisitos objetivo e subjetivo.",
      "O preso mantém direitos não atingidos pela sentença.",
      "A individualização da pena deve orientar a execução.",
      "A assistência material, à saúde e jurídica é prevista na LEP."
    ],
    falseTexts: [
      "A execução penal tem caráter exclusivamente retributivo.",
      "O preso perde todos os seus direitos fundamentais.",
      "A progressão é automática, independentemente de requisitos.",
      "A individualização é irrelevante na execução."
    ]
  }),

  // Informática / RLM
  makeMCQTemplate({
    id: "ti-logica",
    discipline: "Informática/RLM",
    subject: "Lógica Proposicional",
    topic: "lógica proposicional",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "A lógica proposicional trabalha com conectivos e equivalências.",
    tips: [
      "Negação de (p ? q) é p ? ¬q.",
      "Bicondicional exige equivalência lógica.",
      "Tabela-verdade é ferramenta de verificação."
    ],
    correctTexts: [
      "A negação de 'p ? q' equivale a 'p ? ¬q'.",
      "O bicondicional é verdadeiro quando ambas as proposições têm o mesmo valor.",
      "A disjunção exclusiva é verdadeira quando exatamente uma proposição é verdadeira.",
      "A contrapositiva de 'p ? q' é '¬q ? ¬p'.",
      "Equivalências lógicas podem ser verificadas por tabela-verdade."
    ],
    wrongTexts: [
      "A negação de 'p ? q' é '¬p ? q'.",
      "O bicondicional é verdadeiro quando as proposições são diferentes.",
      "A disjunção exclusiva é verdadeira quando ambas são verdadeiras.",
      "A contrapositiva de 'p ? q' é 'q ? p'.",
      "Tabela-verdade não pode ser usada para verificar equivalência."
    ]
  }),
  makeMCQTemplate({
    id: "ti-conjuntos",
    discipline: "Informática/RLM",
    subject: "Conjuntos e Contagem",
    topic: "conjuntos e contagem",
    difficulty: 3,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Operações de conjuntos e inclusão-exclusão resolvem problemas de contagem.",
    tips: [
      "A ? B = A + B - AnB (em cardinalidades).",
      "Complemento depende do universo.",
      "Interseção indica elementos comuns."
    ],
    correctTexts: [
      "|A ? B| = |A| + |B| - |A n B|.",
      "A interseção reúne elementos comuns a dois conjuntos.",
      "O complemento é calculado em relação ao universo.",
      "Se A ? B, então A n B = A.",
      "A união reúne elementos de A ou de B."
    ],
    wrongTexts: [
      "|A ? B| = |A| + |B| + |A n B|.",
      "A interseção reúne todos os elementos de A e de B sem restrição.",
      "O complemento independe do universo considerado.",
      "Se A ? B, então A n B = B.",
      "A união contém apenas elementos comuns aos conjuntos."
    ]
  }),
  makeMCQTemplate({
    id: "ti-seguranca",
    discipline: "Informática/RLM",
    subject: "Segurança da Informação",
    topic: "segurança da informação",
    difficulty: 4,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Segurança da informação envolve confidencialidade, integridade e disponibilidade.",
    tips: [
      "Autenticação identifica; autorização define o que pode fazer.",
      "Criptografia protege confidencialidade e integridade.",
      "Backups aumentam disponibilidade."
    ],
    correctTexts: [
      "Confidencialidade, integridade e disponibilidade formam a tríade CIA.",
      "Autenticação valida a identidade; autorização define permissões.",
      "Criptografia pode garantir confidencialidade e integridade.",
      "Backups periódicos melhoram a disponibilidade.",
      "Hash é função unidirecional para verificação de integridade."
    ],
    wrongTexts: [
      "Confidencialidade e integridade são irrelevantes para segurança.",
      "Autenticação e autorização são sinônimos.",
      "Criptografia serve apenas para compressão de dados.",
      "Backups reduzem a disponibilidade do sistema.",
      "Hash é reversível e recupera o texto original."
    ]
  }),
  makeMCQTemplate({
    id: "ti-redes",
    discipline: "Informática/RLM",
    subject: "Redes",
    topic: "redes e protocolos",
    difficulty: 3,
    styles: ["FGV","VUNESP","FCC"],
    summary: "Protocolos definem comunicação e serviços em redes.",
    tips: [
      "TCP é orientado a conexão e confiável.",
      "UDP é não orientado a conexão.",
      "DNS resolve nomes para IP."
    ],
    correctTexts: [
      "TCP é orientado a conexão e fornece entrega confiável.",
      "UDP é não orientado a conexão e sem garantia de entrega.",
      "DNS traduz nomes de domínio em endereços IP.",
      "HTTP usa, por padrão, a porta 80; HTTPS, a 443.",
      "IP é responsável pelo endereçamento e roteamento."
    ],
    wrongTexts: [
      "UDP é orientado a conexão e confiável.",
      "TCP não realiza controle de fluxo.",
      "DNS é utilizado apenas para criptografar tráfego.",
      "HTTP usa a porta 25 por padrão.",
      "IP é protocolo exclusivo para aplicações."
    ]
  }),
  makeTFTemplate({
    id: "ti-planilhas",
    discipline: "Informática/RLM",
    subject: "Planilhas",
    topic: "planilhas e funções",
    difficulty: 3,
    styles: ["CEBRASPE","CESPE"],
    summary: "Planilhas usam funções e referências relativas/absolutas.",
    tips: [
      "$A$1 é referência absoluta.",
      "Função SE permite testes lógicos.",
      "PROCV busca em coluna."
    ],
    trueTexts: [
      "A referência $A$1 é absoluta em linhas e colunas.",
      "A função SE permite testar uma condição lógica.",
      "PROCV realiza busca vertical na primeira coluna do intervalo.",
      "A função SOMA agrega valores numéricos."
    ],
    falseTexts: [
      "A referência A1 é sempre absoluta.",
      "PROCV busca horizontalmente por padrão.",
      "A função SE não aceita valores lógicos.",
      "SOMA concatena textos em vez de somar."
    ]
  })
];

const PER_TEMPLATE = 20;

export const seedQuestions: Question[] = (() => {
  const out: Question[] = [];
  templates.forEach(t => out.push(...generateFromTemplate(t, PER_TEMPLATE)));
  return out;
})();


