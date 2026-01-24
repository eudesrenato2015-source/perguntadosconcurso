import type { Discipline, ExamStyle, Question, QType } from "../types";

type OptionKey = "A"|"B"|"C"|"D"|"E";

type Choice = { text: string; reason: string };

type MCQChoice = { text: string; correct?: boolean; why?: string };

type Template = {
  id: string;
  discipline: Discipline;
  subject: string;
  topics: string[];
  type: QType;
  make: (ctx: { rng: ()=>number; topic: string }) => {
    statement: string;
    options: { key: OptionKey; text: string }[];
    correctKey: OptionKey;
    explanation: Question["explanation"];
  };
};

const style: ExamStyle = "FGV";

const diffPool: (1|2|3|4|5)[] = [3,4,4,4,5,5,5];

function mulberry32(a: number){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function buildMCQOptions(rng: ()=>number, choices: MCQChoice[]): { options: { key: OptionKey; text: string }[]; correctKey: OptionKey; whyWrong: Partial<Record<OptionKey, string>> }{
  const shuffled = shuffle(rng, choices);
  let correctIndex = shuffled.findIndex(item => item.correct);
  if (correctIndex < 0) correctIndex = 0;
  const options = shuffled.map((item, idx) => ({ key: ["A","B","C","D","E"][idx] as OptionKey, text: item.text }));
  const whyWrong: Partial<Record<OptionKey, string>> = {};
  shuffled.forEach((item, idx) => {
    if (!item.correct && item.why){
      whyWrong[["A","B","C","D","E"][idx] as OptionKey] = item.why;
    }
  });
  return { options, correctKey: ["A","B","C","D","E"][correctIndex] as OptionKey, whyWrong };
}

function mcqFromPools(
  rng: ()=>number,
  statement: string,
  correctPool: Choice[],
  wrongPool: Choice[],
  summary: string,
  tips: string[]
){
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

const ptInterpCorrect: Choice[] = [
  { text: "A inferência depende de indícios textuais e do encadeamento argumentativo.", reason: "FGV cobra inferência ancorada em pistas do texto, não em opinião pessoal." },
  { text: "Conectores e pronomes são pistas de coesão e organizam o sentido global.", reason: "Elementos de coesão são determinantes para a interpretação." },
  { text: "A alternativa correta evita extrapolações além do que o texto permite.", reason: "Extrapolação é erro clássico em interpretação." },
  { text: "O sentido de termos pode variar conforme o gênero e o contexto discursivo.", reason: "Contexto redefine escolhas lexicais e efeitos de sentido." }
];

const ptInterpWrong: Choice[] = [
  { text: "A leitura correta é sempre literal, mesmo que gere contradição com o texto.", reason: "Leitura literal isolada pode distorcer o sentido global." },
  { text: "A interpretação dispensa marcas linguísticas se o tema for conhecido.", reason: "Conhecimento externo não substitui evidências textuais." },
  { text: "A opção mais ampla é preferível, pois abarca mais possibilidades.", reason: "Alternativas amplas demais são distratores frequentes." },
  { text: "A ironia deve ser lida como opinião direta do autor.", reason: "Ironia costuma afirmar o oposto do literal." },
  { text: "A tese do texto é sempre a última frase do último parágrafo.", reason: "Tese não obedece regra fixa de posição." }
];

const ptRegCorrect: Choice[] = [
  { text: "O servidor referiu-se àquela norma no parecer.", reason: "Crase ocorre com a + aquela (pronome demonstrativo)." },
  { text: "A equipe chegou às 18 horas para o plantão.", reason: "Horas determinadas exigem crase (a + as)." },
  { text: "A reunião ocorreu à tarde na sede.", reason: "Expressão temporal feminina admite crase." },
  { text: "O pedido foi encaminhado à diretoria.", reason: "Preposição + artigo definido feminino gera crase." }
];

const ptRegWrong: Choice[] = [
  { text: "O relatório foi entregue à ela ontem.", reason: "Pronomes pessoais não admitem artigo." },
  { text: "A equipe retornou à Roma para o curso.", reason: "Topônimo sem artigo não admite crase." },
  { text: "O chefe enviou o aviso à todos os setores.", reason: "Antes de 'todos', não há artigo: 'a todos'." },
  { text: "O acusado respondeu à perguntas do juiz.", reason: "Sem artigo definido no plural, a crase é inadequada." },
  { text: "Ele foi à pé até o posto.", reason: "Antes de palavra masculina, não há crase." }
];

const logicCorrect: Choice[] = [
  { text: "A implicação p → q é falsa apenas quando p é verdadeira e q é falsa.", reason: "Regra clássica da implicação." },
  { text: "A negação de (p ∧ q) é (¬p ∨ ¬q).", reason: "Lei de De Morgan para conjunção." },
  { text: "A bicondicional p ↔ q é verdadeira quando p e q têm o mesmo valor lógico.", reason: "Bicondicional exige equivalência." },
  { text: "Se p é falsa, então p → q é verdadeira.", reason: "Implicação com antecedente falso é verdadeira." }
];

const logicWrong: Choice[] = [
  { text: "A implicação p → q é equivalente a p ∧ q.", reason: "Implicação não é conjunção." },
  { text: "A negação de (p ∧ q) é (¬p ∧ ¬q).", reason: "A negação correta é disjunção." },
  { text: "A bicondicional é verdadeira quando p e q são diferentes.", reason: "Bicondicional exige valores iguais." },
  { text: "Se p é falsa, então p → q é falsa.", reason: "É verdadeira quando p é falsa." },
  { text: "A negação de (p ∨ q) é (¬p ∨ ¬q).", reason: "A negação correta é conjunção." }
];

const logicMathCorrect: Choice[] = [
  { text: "A união A ∪ B reúne elementos de A e de B.", reason: "União agrega elementos dos conjuntos." },
  { text: "A interseção A ∩ B reúne apenas elementos comuns.", reason: "Interseção contém o que é comum." },
  { text: "Em proporção direta, aumento de uma grandeza implica aumento da outra.", reason: "Grandezas variam no mesmo sentido." },
  { text: "Regra de três simples resolve proporcionalidades entre duas grandezas.", reason: "Ferramenta clássica de proporções." }
];

const logicMathWrong: Choice[] = [
  { text: "A união A ∪ B reúne apenas elementos comuns.", reason: "Isso descreve a interseção." },
  { text: "A interseção A ∩ B reúne todos os elementos de A e B.", reason: "Isso descreve a união." },
  { text: "Em proporção inversa, aumento de uma grandeza implica aumento da outra.", reason: "Na inversa, uma aumenta enquanto a outra diminui." },
  { text: "Regra de três simples é usada apenas com três grandezas independentes.", reason: "Ela usa duas grandezas com proporção." }
];

const argumentTrue: Choice[] = [
  { text: "Se todo policial é servidor e João é policial, então João é servidor.", reason: "Silogismo categórico válido." },
  { text: "Se p → q e p é verdadeira, então q é verdadeira.", reason: "Modus ponens é válido." },
  { text: "Se p → q e ¬q, então ¬p.", reason: "Modus tollens é válido." }
];

const argumentFalse: Choice[] = [
  { text: "Se p → q e q é verdadeira, então p é verdadeira.", reason: "Afirmação do consequente é falácia." },
  { text: "Se p → q e ¬p, então ¬q.", reason: "Negação do antecedente é falácia." },
  { text: "Todo A é B; logo, todo B é A.", reason: "A conversão não é válida em geral." }
];

const infoSecCorrect: Choice[] = [
  { text: "Phishing é técnica de engenharia social para capturar credenciais.", reason: "Engana o usuário para obter dados." },
  { text: "MFA reduz risco ao exigir mais de um fator de autenticação.", reason: "Multiplica barreiras de acesso." },
  { text: "Backup offline ajuda na recuperação após ransomware.", reason: "Cópias isoladas reduzem impacto." },
  { text: "Hashing gera resumo unidirecional para integridade.", reason: "Hash não é reversível por design." }
];

const infoSecWrong: Choice[] = [
  { text: "Phishing é um tipo de firewall.", reason: "Phishing é fraude, não defesa." },
  { text: "Hashing é reversível, como criptografia simétrica.", reason: "Hash é unidirecional." },
  { text: "MFA elimina a necessidade de senha e aumenta o risco.", reason: "MFA adiciona fatores, não risco." },
  { text: "Ransomware não compromete disponibilidade.", reason: "Ele bloqueia o acesso aos dados." }
];

const infoNetCorrect: Choice[] = [
  { text: "DNS traduz nomes de domínio em endereços IP.", reason: "Resolução de nomes." },
  { text: "HTTPS é HTTP sobre TLS, garantindo confidencialidade e integridade.", reason: "TLS protege o tráfego HTTP." },
  { text: "TCP é orientado a conexão e garante entrega ordenada.", reason: "TCP é confiável e ordenado." },
  { text: "A camada de enlace trata de comunicação local e endereçamento físico.", reason: "Enlace lida com MAC e quadros." }
];

const infoNetWrong: Choice[] = [
  { text: "HTTP é protocolo da camada de enlace.", reason: "HTTP é da camada de aplicação." },
  { text: "DNS criptografa o tráfego de rede.", reason: "DNS não cifra tráfego." },
  { text: "TCP é sem conexão e sem controle de fluxo.", reason: "TCP é orientado a conexão e tem controle de fluxo." },
  { text: "IP pertence à camada de aplicação.", reason: "IP é camada de rede." }
];

const officeCorrect: Choice[] = [
  { text: "No Excel, fórmulas costumam iniciar com o sinal '='.", reason: "O '=' indica expressão e cálculo." },
  { text: "No Word, estilos aplicam formatação consistente ao texto.", reason: "Estilos padronizam fontes e espaçamentos." },
  { text: "No PowerPoint, o modo apresentação exibe os slides em tela cheia.", reason: "É o modo de exibição para público." },
  { text: "No Outlook, anexos podem ser adicionados à mensagem antes do envio.", reason: "Anexos são parte do e-mail." }
];

const officeWrong: Choice[] = [
  { text: "No Excel, fórmulas não podem usar referências de células.", reason: "Fórmulas usam referências." },
  { text: "No Word, estilos servem apenas para inserir imagens.", reason: "Estilos tratam de formatação textual." },
  { text: "No PowerPoint, slides não podem conter vídeos.", reason: "Slides suportam mídia." },
  { text: "No Outlook, anexos são adicionados somente após o envio.", reason: "Anexos são adicionados antes do envio." }
];

const goFactsCorrect: Choice[] = [
  { text: "Goiás está situado na região Centro-Oeste do Brasil.", reason: "A localização regional é Centro-Oeste." },
  { text: "Goiânia é a capital do Estado de Goiás.", reason: "Goiânia é a capital estadual." },
  { text: "O bioma predominante em Goiás é o Cerrado.", reason: "O Cerrado é característico do Centro-Oeste." },
  { text: "O clima predominante é tropical, com estação chuvosa e estação seca.", reason: "O clima é tropical com duas estações bem definidas." }
];

const goFactsWrong: Choice[] = [
  { text: "Goiás está localizado na região Nordeste do Brasil.", reason: "Goiás é Centro-Oeste." },
  { text: "A capital do Estado de Goiás é Brasília.", reason: "Brasília é capital federal, não de Goiás." },
  { text: "O bioma predominante em Goiás é a Amazônia.", reason: "O bioma predominante é o Cerrado." },
  { text: "O clima predominante é polar, com inverno rigoroso.", reason: "O clima é tropical." }
];

const goEcoCorrect: Choice[] = [
  { text: "O setor de serviços é pilar importante da economia de Goiânia.", reason: "O setor de serviços é destacado como pilar econômico da capital." },
  { text: "O agronegócio tem papel relevante na economia goiana.", reason: "O estado é fortemente impulsionado pelo agronegócio." },
  { text: "A indústria goiana se diversificou com destaque para alimentos e bebidas.", reason: "Alimentos e bebidas são setores de destaque." }
];

const goEcoWrong: Choice[] = [
  { text: "A economia goiana é baseada quase exclusivamente na mineração artesanal.", reason: "A economia é diversificada com agronegócio, serviços e indústria." },
  { text: "O setor de serviços é irrelevante para Goiânia.", reason: "Serviços são pilar da capital." },
  { text: "Goiás não possui atividade industrial significativa.", reason: "O estado tem indústria diversificada." }
];

const goSocCorrect: Choice[] = [
  { text: "A administração estadual tem sede em Goiânia, capital de Goiás.", reason: "Goiânia concentra a sede do governo estadual." },
  { text: "A cultura goiana reflete tradições do interior e manifestações religiosas e musicais.", reason: "A diversidade cultural é característica do estado." },
  { text: "A política estadual se organiza com Poder Executivo, Legislativo e Judiciário.", reason: "Estrutura clássica dos poderes estaduais." }
];

const goSocWrong: Choice[] = [
  { text: "O estado de Goiás não possui Poder Legislativo próprio.", reason: "O estado possui Assembleia Legislativa." },
  { text: "A capital administrativa do estado é Brasília.", reason: "Brasília é capital federal, não estadual." },
  { text: "Goiás não possui manifestações culturais regionais relevantes.", reason: "A cultura regional é rica e diversa." }
];

const legCorrect: Choice[] = [
  { text: "A Constituição Estadual deve observar princípios da Constituição Federal.", reason: "Há princípio da simetria constitucional." },
  { text: "O processo legislativo estadual segue regras definidas na Constituição Estadual.", reason: "A CE regula processo e competências." },
  { text: "A administração pública estadual submete-se aos princípios do art. 37 da CF.", reason: "Princípios são aplicáveis a toda a Administração." },
  { text: "Resoluções internas disciplinam organização e funcionamento da ALEGO.", reason: "Atos internos regulam estrutura e rotinas administrativas." }
];

const legWrong: Choice[] = [
  { text: "O estado pode contrariar princípios constitucionais federais por autonomia plena.", reason: "Autonomia não é soberania; há limites federais." },
  { text: "A Constituição Estadual não pode tratar de processo legislativo.", reason: "Trata sim, dentro dos limites da CF." },
  { text: "O controle de legalidade não se aplica a atos da administração estadual.", reason: "Administração estadual está sujeita a controle." },
  { text: "Atos internos da ALEGO dispensam publicação e transparência.", reason: "Publicidade é princípio geral, com exceções legais." }
];

const legActsCorrect: Choice[] = [
  { text: "Resoluções internas disciplinam a organização e o funcionamento da ALEGO.", reason: "Atos internos regem a estrutura e rotinas do órgão." },
  { text: "O Regimento Interno é ato normativo interno aprovado por resolução.", reason: "Regimentos internos são formalizados por resolução." },
  { text: "A Lei nº 13.675/2018 institui o Sistema Único de Segurança Pública (SUSP).", reason: "A lei cria o SUSP e diretrizes de integração." },
  { text: "Atos internos devem respeitar princípios constitucionais e publicidade.", reason: "Princípios do art. 37 se aplicam." }
];

const legActsWrong: Choice[] = [
  { text: "Resoluções internas têm hierarquia superior à Constituição Estadual.", reason: "Atos internos não se sobrepõem à Constituição." },
  { text: "O Regimento Interno é uma lei federal imutável pela ALEGO.", reason: "Regimento interno é ato do próprio órgão." },
  { text: "A Lei nº 13.675/2018 extinguiu o SUSP e vedou cooperação federativa.", reason: "A lei institui o SUSP e incentiva integração." },
  { text: "Atos internos dispensam transparência por não integrarem a Administração Pública.", reason: "A ALEGO integra a Administração Pública." }
];

const constCorrect: Choice[] = [
  { text: "Direitos fundamentais admitem ponderação em conflitos entre princípios.", reason: "Não são absolutos." },
  { text: "A separação de poderes inclui controles recíprocos.", reason: "Freios e contrapesos são previstos." },
  { text: "A legalidade é princípio estruturante da Administração Pública.", reason: "Legalidade vincula a atuação administrativa." }
];

const constWrong: Choice[] = [
  { text: "Direitos fundamentais são sempre absolutos e ilimitados.", reason: "Há limites e ponderação." },
  { text: "A separação de poderes elimina qualquer controle entre Poderes.", reason: "Há controles recíprocos." },
  { text: "A Administração pode agir sem base legal se houver interesse público.", reason: "Legalidade exige base legal." }
];

const admCorrect: Choice[] = [
  { text: "A anulação corrige ilegalidade; a revogação decorre de mérito administrativo.", reason: "Ilegalidade → anulação; conveniência → revogação." },
  { text: "A presunção de legitimidade do ato é relativa.", reason: "Admite prova em contrário." },
  { text: "O poder de polícia limita direitos em nome do interesse público.", reason: "É poder limitador e preventivo." }
];

const admWrong: Choice[] = [
  { text: "A revogação é usada para corrigir atos ilegais.", reason: "Ilegalidade se corrige por anulação." },
  { text: "A presunção de legitimidade é absoluta.", reason: "É relativa." },
  { text: "O poder de polícia só atua após o dano ocorrer.", reason: "É preventivo." }
];

const humanCorrect: Choice[] = [
  { text: "A escuta ativa é essencial para atendimento com empatia.", reason: "Melhora compreensão e reduz conflitos." },
  { text: "A comunicação assertiva evita ruídos e agressividade.", reason: "Assertividade equilibra clareza e respeito." },
  { text: "A gestão de conflitos busca solução e preservação da dignidade.", reason: "Foco em resolver sem escalonar." }
];

const humanWrong: Choice[] = [
  { text: "O atendimento eficiente dispensa cordialidade.", reason: "Cordialidade melhora a experiência e reduz tensão." },
  { text: "A melhor abordagem é sempre autoritária.", reason: "Abordagem depende do contexto e deve ser proporcional." },
  { text: "A escuta ativa é perda de tempo em atendimento público.", reason: "Escuta ativa é técnica essencial." }
];

const opCorrect: Choice[] = [
  { text: "O uso da força deve observar necessidade, proporcionalidade e legalidade.", reason: "Princípios norteadores do uso progressivo da força." },
  { text: "A observação do ambiente é etapa crítica antes de qualquer intervenção.", reason: "Avaliar risco reduz incidentes." },
  { text: "A distância de segurança é ferramenta para reduzir escalada.", reason: "Distância permite reação e diálogo." }
];

const opWrong: Choice[] = [
  { text: "A força deve ser usada no maior nível disponível para intimidar.", reason: "Uso progressivo veda excesso." },
  { text: "A abordagem deve ignorar avaliação de risco para ganhar tempo.", reason: "Avaliação é etapa obrigatória." },
  { text: "A distância de segurança é irrelevante em ambientes públicos.", reason: "Distância é técnica de controle." }
];

const fireCorrect: Choice[] = [
  { text: "Planos de evacuação e treinamento são medidas centrais de prevenção.", reason: "NR-23 enfatiza prevenção e preparo." },
  { text: "Extintores devem ser acessíveis e sinalizados.", reason: "Sinalização e acesso são requisitos básicos." },
  { text: "No APH, a segurança da cena é prioridade antes do atendimento.", reason: "Socorrista só atua com segurança." },
  { text: "Prevenção e combate a incêndios exigem cooperação com o Corpo de Bombeiros.", reason: "A atuação é integrada com bombeiros." }
];

const fireWrong: Choice[] = [
  { text: "Treinamento é dispensável se houver extintores.", reason: "Treinamento é exigência de prevenção." },
  { text: "Sinalização de saída é opcional em ambientes públicos.", reason: "Sinalização é medida obrigatória." },
  { text: "No APH, o atendimento precede a avaliação da cena.", reason: "Segurança da cena é prioridade." },
  { text: "Combate a incêndio é tarefa isolada, sem cooperação com bombeiros.", reason: "A cooperação com bombeiros é prevista." }
];

const intelCorrect: Choice[] = [
  { text: "O ciclo de inteligência envolve planejar, coletar, analisar e difundir.", reason: "Fases clássicas do ciclo de inteligência." },
  { text: "A gestão de riscos exige identificação, avaliação e tratamento.", reason: "Etapas essenciais da análise de riscos." },
  { text: "Informação precisa e oportuna reduz decisões baseadas em achismo.", reason: "Inteligência apoia decisão." }
];

const intelWrong: Choice[] = [
  { text: "O ciclo de inteligência se resume à coleta de dados.", reason: "Há etapas de análise e difusão." },
  { text: "Risco é eliminado apenas com equipamentos.", reason: "Gestão de risco envolve processos e pessoas." },
  { text: "A difusão da informação é desnecessária em segurança.", reason: "A difusão orienta decisões." }
];

const escortCorrect: Choice[] = [
  { text: "A escolta exige planejamento de rota, alternativas e pontos de apoio.", reason: "Planejamento reduz exposição a riscos." },
  { text: "Comunicação constante e formação da equipe são essenciais.", reason: "Integração reduz falhas operacionais." },
  { text: "Varredura prévia do local é medida de prevenção.", reason: "Reconhecimento reduz vulnerabilidades." }
];

const escortWrong: Choice[] = [
  { text: "A rota mais curta é sempre a mais segura, dispensando alternativas.", reason: "Rota segura pode exigir desvios e contingências." },
  { text: "Comunicação pode ser dispensada para evitar chamar atenção.", reason: "Comunicação é requisito operacional." },
  { text: "A formação da equipe é irrelevante em escoltas.", reason: "Formação organiza proteção e reação." }
];

const securityCorrect: Choice[] = [
  { text: "Controle de acesso e credenciamento são barreiras básicas.", reason: "Barreiras reduzem entrada não autorizada." },
  { text: "Segurança patrimonial integra pessoas, processos e tecnologia.", reason: "Tecnologia isolada não garante proteção." },
  { text: "Avaliação de vulnerabilidades é contínua.", reason: "Riscos mudam com o contexto." }
];

const securityWrong: Choice[] = [
  { text: "Segurança física se resume a câmeras e alarmes.", reason: "Sem procedimentos e pessoal, tecnologia falha." },
  { text: "Controle de acesso viola a legalidade e deve ser evitado.", reason: "Controle é legítimo quando proporcional." },
  { text: "Vulnerabilidades são fixas e dispensam revisão periódica.", reason: "Risco é dinâmico." }
];

const policeCorrect: Choice[] = [
  { text: "A polícia legislativa atua na manutenção da ordem e segurança interna da ALEGO.", reason: "Atribuições incluem policiamento e segurança interna." },
  { text: "É possível identificar e revistar pessoas, conforme protocolos e legalidade.", reason: "Identificação e revista constam das atribuições." },
  { text: "Pode recolher temporariamente armas portadas por visitantes.", reason: "A guarda temporária integra o controle interno." },
  { text: "Buscas em pessoas e veículos podem ocorrer para prevenção e investigação.", reason: "Atribuição prevista para prevenção e investigação." }
];

const policeWrong: Choice[] = [
  { text: "A polícia legislativa exerce policiamento externo em todo o Estado.", reason: "A atuação é interna às dependências da ALEGO." },
  { text: "A identificação de visitantes é vedada em qualquer hipótese.", reason: "A identificação pode ser necessária à segurança." },
  { text: "Armas de visitantes devem ser descartadas, nunca guardadas.", reason: "A guarda é temporária e controlada." },
  { text: "A retirada de pessoas que perturbam atividades depende de ordem judicial.", reason: "A intervenção pode ser imediata para garantir a ordem." }
];

const investigationCorrect: Choice[] = [
  { text: "Pode realizar diligências e serviço cartorial em apoio a comissões, inclusive CPIs.", reason: "Apoio a comissões e CPIs integra as atribuições." },
  { text: "Realiza ações investigativas para subsidiar polícia judiciária e apurações penais.", reason: "Atribuição prevista no âmbito da ALEGO." },
  { text: "Executa coleta, busca, estatística e análise de dados de interesse policial.", reason: "A atividade analítica integra o trabalho." }
];

const investigationWrong: Choice[] = [
  { text: "É vedada a coleta e análise de dados de interesse policial.", reason: "A coleta e análise são atribuições previstas." },
  { text: "Diligências para comissões e CPIs são exclusivas de órgãos externos.", reason: "A polícia legislativa presta apoio direto." },
  { text: "A polícia legislativa não participa de apurações penais em nenhuma hipótese.", reason: "Há atuação de apoio às apurações." }
];

const accessCorrect: Choice[] = [
  { text: "Inspecionar entrada e saída de volumes e objetos integra a segurança interna.", reason: "Inspeção de volumes e objetos é atribuição prevista." },
  { text: "O controle de acesso exige procedimentos e registros para prevenir riscos.", reason: "Controle de acesso é medida preventiva." }
];

const accessWrong: Choice[] = [
  { text: "A inspeção de volumes é dispensável em ambientes legislativos.", reason: "A inspeção é medida de segurança." },
  { text: "Controle de acesso é incompatível com a legalidade administrativa.", reason: "Controle é legítimo e proporcional." }
];

const incidentCorrect: Choice[] = [
  { text: "A negociação busca reduzir risco e preservar vidas.", reason: "Prioridade é contenção e segurança." },
  { text: "Isolamento de área e comando unificado são medidas críticas.", reason: "Coordenação evita decisões conflitantes." },
  { text: "Gestão de incidentes críticos exige registro e comunicação clara.", reason: "Documentação orienta tomada de decisão." }
];

const incidentWrong: Choice[] = [
  { text: "A prioridade é a prisão imediata, ainda que haja reféns.", reason: "Preservação de vidas é prioridade." },
  { text: "Negociação é sinal de fraqueza e deve ser evitada.", reason: "Negociação é técnica de redução de risco." },
  { text: "Em incidentes críticos, cada equipe decide isoladamente.", reason: "Comando unificado é essencial." }
];

const templates: Template[] = [
  {
    id: "pt-interp",
    discipline: "Português",
    subject: "Língua Portuguesa",
    topics: ["interpretação", "coesão", "inferência"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      ptInterpCorrect,
      ptInterpWrong,
      "Interpretação exige coerência e evidências do texto.",
      ["Evite extrapolações.", "Conectivos são pistas de sentido."]
    )
  },
  {
    id: "pt-reg",
    discipline: "Português",
    subject: "Língua Portuguesa",
    topics: ["crase", "regência", "norma culta"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      ptRegCorrect,
      ptRegWrong,
      "Crase decorre de regência + artigo definido.",
      ["Antes de palavra masculina não há crase.", "Com pronomes pessoais não ocorre crase."]
    )
  },
  {
    id: "rlm-logic",
    discipline: "Informática/RLM",
    subject: "Raciocínio Lógico",
    topics: ["equivalências", "negações", "implicação"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      logicCorrect,
      logicWrong,
      "Lógica proposicional segue equivalências clássicas.",
      ["Use De Morgan.", "Implicação só é falsa com p verdadeiro e q falso."]
    )
  },
  {
    id: "rlm-arg",
    discipline: "Informática/RLM",
    subject: "Raciocínio Lógico",
    topics: ["validade de argumentos", "silogismos"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      argumentTrue,
      argumentFalse,
      "FGV cobra identificação de falácias e argumentos válidos.",
      ["Modus ponens e tollens são válidos.", "Cuidado com afirmação do consequente."]
    )
  },
  {
    id: "rlm-math",
    discipline: "Informática/RLM",
    subject: "Raciocínio Lógico",
    topics: ["conjuntos", "proporções", "regra de três"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      logicMathCorrect,
      logicMathWrong,
      "Conjuntos e proporcionalidade exigem leitura cuidadosa.",
      ["União ≠ interseção.", "Direta e inversa não se confundem."]
    )
  },
  {
    id: "info-sec",
    discipline: "Informática/RLM",
    subject: "Noções de Informática",
    topics: ["segurança da informação", "engenharia social"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      infoSecCorrect,
      infoSecWrong,
      "Segurança envolve confidencialidade, integridade e disponibilidade.",
      ["Desconfie de atalhos fáceis.", "MFA reduz risco." ]
    )
  },
  {
    id: "info-net",
    discipline: "Informática/RLM",
    subject: "Noções de Informática",
    topics: ["redes", "protocolos"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      infoNetCorrect,
      infoNetWrong,
      "Protocolos definem funções por camada.",
      ["DNS resolve nomes.", "TCP é confiável e orientado a conexão."]
    )
  },
  {
    id: "info-office",
    discipline: "Informática/RLM",
    subject: "Noções de Informática",
    topics: ["Word/Excel/PowerPoint/Outlook", "produtividade"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      officeCorrect,
      officeWrong,
      "Ferramentas de escritório cobram conceitos básicos e atalhos.",
      ["Fórmulas no Excel começam com '='.", "Estilos do Word padronizam formatação."]
    )
  },
  {
    id: "go-real",
    discipline: "DH/Criminologia",
    subject: "Realidade de Goiás",
    topics: ["geografia", "história", "cultura", "política"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic} de Goiás, assinale a alternativa correta:`,
      goFactsCorrect,
      goFactsWrong,
      "Conhecimentos gerais de Goiás caem com frequência.",
      ["Localização regional é Centro-Oeste.", "Capital é Goiânia."]
    )
  },
  {
    id: "go-eco",
    discipline: "DH/Criminologia",
    subject: "Realidade de Goiás",
    topics: ["economia", "setores produtivos"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic} de Goiás, assinale a alternativa correta:`,
      goEcoCorrect,
      goEcoWrong,
      "A economia goiana é diversificada.",
      ["Serviços e agronegócio são relevantes."]
    )
  },
  {
    id: "go-soc",
    discipline: "DH/Criminologia",
    subject: "Realidade de Goiás",
    topics: ["cultura", "política", "sociedade"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic} de Goiás, assinale a alternativa correta:`,
      goSocCorrect,
      goSocWrong,
      "Aspectos culturais e políticos são frequentes no edital.",
      ["A capital é Goiânia.", "Estrutura de poderes é clássica."]
    )
  },
  {
    id: "leg-go",
    discipline: "Administrativo",
    subject: "Legislação do Estado de Goiás",
    topics: ["processo legislativo", "resoluções internas", "princípios"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      legCorrect,
      legWrong,
      "A legislação estadual observa limites constitucionais.",
      ["Autonomia não é soberania."]
    )
  },
  {
    id: "leg-atos",
    discipline: "Administrativo",
    subject: "Legislação do Estado de Goiás",
    topics: ["Regimento Interno", "Resoluções ALEGO", "SUSP"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      legActsCorrect,
      legActsWrong,
      "Atos internos e legislação setorial aparecem no conteúdo programático.",
      ["Resoluções disciplinam o órgão.", "A Lei 13.675/2018 institui o SUSP."]
    )
  },
  {
    id: "dir-const",
    discipline: "Constitucional",
    subject: "Noções de Direito Constitucional",
    topics: ["direitos fundamentais", "separação de poderes"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      constCorrect,
      constWrong,
      "Direitos fundamentais admitem ponderação.",
      ["Evite alternativas absolutas."]
    )
  },
  {
    id: "dir-adm",
    discipline: "Administrativo",
    subject: "Noções de Direito Administrativo",
    topics: ["atos administrativos", "poder de polícia"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      admCorrect,
      admWrong,
      "Atos administrativos obedecem legalidade.",
      ["Revogação não corrige ilegalidade."]
    )
  },
  {
    id: "relacoes",
    discipline: "DH/Criminologia",
    subject: "Relações Humanas e Atendimento",
    topics: ["comunicação", "conflitos"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      humanCorrect,
      humanWrong,
      "Atendimento exige empatia e clareza.",
      ["Escuta ativa reduz conflitos."]
    )
  },
  {
    id: "defesa",
    discipline: "Penal/Proc Penal",
    subject: "Defesa Pessoal e Segurança",
    topics: ["uso progressivo da força", "abordagem"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      opCorrect,
      opWrong,
      "Uso da força deve ser proporcional e legal.",
      ["Avaliar risco é etapa obrigatória."]
    )
  },
  {
    id: "incendio-aph",
    discipline: "Penal/Proc Penal",
    subject: "Incêndio e APH",
    topics: ["prevenção", "primeiros socorros"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      fireCorrect,
      fireWrong,
      "Prevenção e segurança da cena são prioridades.",
      ["Treinamento é essencial."]
    )
  },
  {
    id: "escorta",
    discipline: "Penal/Proc Penal",
    subject: "Operações de Proteção e Escolta",
    topics: ["planejamento de rota", "formação de equipe", "varredura"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      escortCorrect,
      escortWrong,
      "Escolta exige planejamento, comunicação e contingências.",
      ["Rota segura nem sempre é a mais curta.", "Planejamento reduz exposição."]
    )
  },
  {
    id: "patrimonial",
    discipline: "Penal/Proc Penal",
    subject: "Segurança Física e Patrimonial",
    topics: ["controle de acesso", "vigilância", "vulnerabilidades"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      securityCorrect,
      securityWrong,
      "Segurança patrimonial integra pessoas, processos e tecnologia.",
      ["Tecnologia isolada não basta.", "Avaliação de risco é contínua."]
    )
  },
  {
    id: "policial-ordem",
    discipline: "Penal/Proc Penal",
    subject: "Polícia Legislativa",
    topics: ["policiamento interno", "ordem", "revista"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      policeCorrect,
      policeWrong,
      "A atuação da polícia legislativa foca na segurança interna.",
      ["Atribuições incluem revista e controle.", "Atuação é interna."]
    )
  },
  {
    id: "policial-acesso",
    discipline: "Penal/Proc Penal",
    subject: "Polícia Legislativa",
    topics: ["controle de acesso", "inspeção de volumes"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      accessCorrect,
      accessWrong,
      "Controle de acesso é medida preventiva e proporcional.",
      ["Inspeção protege atividades.", "Registros ajudam na segurança."]
    )
  },
  {
    id: "incidentes",
    discipline: "DH/Criminologia",
    subject: "Incidentes Críticos e Negociação",
    topics: ["negociação", "comando unificado", "isolamento"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      incidentCorrect,
      incidentWrong,
      "Gestão de incidentes críticos prioriza preservação de vidas.",
      ["Negociação reduz risco.", "Isolamento protege a cena."]
    )
  },
  {
    id: "policial-invest",
    discipline: "Administrativo",
    subject: "Polícia Legislativa",
    topics: ["investigação", "coleta de dados", "apoio a CPIs"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Sobre ${topic}, assinale a alternativa correta:`,
      investigationCorrect,
      investigationWrong,
      "A atuação inclui apoio investigativo e análise de dados.",
      ["Apoio a CPIs é atribuição prevista.", "Dados orientam decisões."]
    )
  },
  {
    id: "inteligencia",
    discipline: "Administrativo",
    subject: "Inteligência e Análise de Riscos",
    topics: ["ciclo de inteligência", "gestão de riscos"],
    type: "MCQ",
    make: ({ rng, topic }) => mcqFromPools(
      rng,
      `(ALEGO) Em ${topic}, assinale a alternativa correta:`,
      intelCorrect,
      intelWrong,
      "Inteligência organiza informação para decisão.",
      ["Gestão de risco exige identificação e tratamento."]
    )
  }
];

export const alegoQuestions: Question[] = (() => {
  const rng = mulberry32(1901);
  const out: Question[] = [];
  let n = 1;
  const perTemplate = 8;

  for (const template of templates){
    for (let i=0;i<perTemplate;i++){
      const topic = pick(rng, template.topics);
      const diff = pick(rng, diffPool);
      const built = template.make({ rng, topic });
      out.push({
        id: `alego-${template.id}-${n++}`,
        discipline: template.discipline,
        subject: template.subject,
        topic,
        difficulty: diff,
        type: template.type,
        style,
        statement: built.statement,
        options: built.options,
        correctKey: built.correctKey,
        explanation: built.explanation
      });
    }
  }
  return out;
})();
