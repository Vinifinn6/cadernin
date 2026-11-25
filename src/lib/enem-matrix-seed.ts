import type { EnemArea } from "@/types/database";

export interface EnemSkillSeedItem {
  area: EnemArea;
  code: string;
  competency: string;
  description: string;
}

export const ENEM_AREA_META: Record<
  EnemArea,
  { label: string; shortLabel: string; accent: string }
> = {
  linguagens: {
    label: "Linguagens, Códigos e suas Tecnologias",
    shortLabel: "Linguagens",
    accent: "var(--accent-terracotta)",
  },
  humanas: {
    label: "Ciências Humanas e suas Tecnologias",
    shortLabel: "Humanas",
    accent: "var(--accent-ochre)",
  },
  natureza: {
    label: "Ciências da Natureza e suas Tecnologias",
    shortLabel: "Natureza",
    accent: "var(--accent-sage)",
  },
  matematica: {
    label: "Matemática e suas Tecnologias",
    shortLabel: "Matemática",
    accent: "var(--accent-slate)",
  },
};

export const ENEM_BASE_MATRIX: EnemSkillSeedItem[] = [
  // =========================================================================
  // LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS (C1–C9 · H1–H30)
  // =========================================================================
  { area: "linguagens", code: "H1", competency: "C1", description: "Identificar as diferentes linguagens e seus recursos expressivos como elementos de caracterização dos sistemas de comunicação." },
  { area: "linguagens", code: "H2", competency: "C1", description: "Recorrer aos conhecimentos sobre as linguagens dos sistemas de comunicação e informação para resolver problemas sociais." },
  { area: "linguagens", code: "H3", competency: "C1", description: "Relacionar informações geradas nos sistemas de comunicação e informação, considerando a função social desses sistemas." },
  { area: "linguagens", code: "H4", competency: "C1", description: "Reconhecer posições críticas aos usos sociais que são feitos das linguagens e dos sistemas de comunicação e informação." },
  { area: "linguagens", code: "H5", competency: "C2", description: "Associar vocábulos e expressões de um texto em LEM ao seu tema." },
  { area: "linguagens", code: "H6", competency: "C2", description: "Utilizar os conhecimentos da LEM e de seus mecanismos como meio de ampliar as possibilidades de acesso a informações, tecnologias e culturas." },
  { area: "linguagens", code: "H7", competency: "C2", description: "Relacionar um texto em LEM, as estruturas linguísticas, sua função e seu uso social." },
  { area: "linguagens", code: "H8", competency: "C2", description: "Reconhecer a importância da produção cultural em LEM como representação da diversidade cultural e linguística." },
  { area: "linguagens", code: "H9", competency: "C3", description: "Reconhecer as manifestações corporais de movimento como originárias de necessidades cotidianas de um grupo social." },
  { area: "linguagens", code: "H10", competency: "C3", description: "Reconhecer a necessidade de transformação de hábitos corporais em função das necessidades cinestésicas." },
  { area: "linguagens", code: "H11", competency: "C3", description: "Reconhecer a linguagem corporal como meio de interação social, considerando os limites de desempenho e as alternativas de adaptação para diferentes indivíduos." },
  { area: "linguagens", code: "H12", competency: "C4", description: "Reconhecer diferentes funções da arte, do trabalho da produção dos artistas em seus meios culturais." },
  { area: "linguagens", code: "H13", competency: "C4", description: "Analisar as diversas produções artísticas como meio de explicar diferentes culturas, padrões de beleza e preconceitos." },
  { area: "linguagens", code: "H14", competency: "C4", description: "Reconhecer o valor da diversidade artística e das inter-relações de elementos que se apresentam nas manifestações de vários grupos sociais e étnicos." },
  { area: "linguagens", code: "H15", competency: "C5", description: "Estabelecer relações entre o texto literário e o momento de sua produção, situando aspectos do contexto histórico, social e político." },
  { area: "linguagens", code: "H16", competency: "C5", description: "Relacionar informações sobre concepções artísticas e procedimentos de construção do texto literário." },
  { area: "linguagens", code: "H17", competency: "C5", description: "Reconhecer a presença de valores sociais e humanos atualizáveis e permanentes no patrimônio literário nacional." },
  { area: "linguagens", code: "H18", competency: "C6", description: "Identificar os elementos que concorrem para a progressão temática e para a organização e estruturação de textos de diferentes gêneros e tipos." },
  { area: "linguagens", code: "H19", competency: "C6", description: "Analisar a função da linguagem predominante nos textos em situações específicas de interlocução." },
  { area: "linguagens", code: "H20", competency: "C6", description: "Reconhecer a importância do patrimônio linguístico para a preservação da memória e da identidade nacional." },
  { area: "linguagens", code: "H21", competency: "C7", description: "Reconhecer em textos de diferentes gêneros, recursos verbais e não-verbais utilizados com a finalidade de criar e mudar comportamentos e hábitos." },
  { area: "linguagens", code: "H22", competency: "C7", description: "Relacionar, em diferentes textos, opiniões, temas, assuntos e recursos linguísticos." },
  { area: "linguagens", code: "H23", competency: "C7", description: "Inferir em um texto quais são os objetivos de seu produtor e quem é seu público alvo, pela análise dos procedimentos argumentativos utilizados." },
  { area: "linguagens", code: "H24", competency: "C7", description: "Reconhecer no texto estratégias argumentativas empregadas para o convencimento do público, tais como a intimidação, sedução, comoção, chantagem, entre outras." },
  { area: "linguagens", code: "H25", competency: "C8", description: "Identificar, em textos de diferentes gêneros, as marcas linguísticas que singularizam as variedades linguísticas sociais, regionais e de registro." },
  { area: "linguagens", code: "H26", competency: "C8", description: "Relacionar as variedades linguísticas a situações específicas de uso social." },
  { area: "linguagens", code: "H27", competency: "C8", description: "Reconhecer os usos da norma padrão da língua portuguesa nas diferentes situações de comunicação." },
  { area: "linguagens", code: "H28", competency: "C9", description: "Reconhecer a função e o impacto social das diferentes tecnologias da comunicação e informação." },
  { area: "linguagens", code: "H29", competency: "C9", description: "Identificar pela análise de suas linguagens, as tecnologias da comunicação e informação." },
  { area: "linguagens", code: "H30", competency: "C9", description: "Relacionar as tecnologias de comunicação e informação ao desenvolvimento das sociedades e ao conhecimento que elas produzem." },

  // =========================================================================
  // CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS (C1–C6 · H1–H30)
  // =========================================================================
  { area: "humanas", code: "H1", competency: "C1", description: "Interpretar historicamente e/ou geograficamente fontes documentais acerca de aspectos da cultura." },
  { area: "humanas", code: "H2", competency: "C1", description: "Analisar a produção da memória pelas sociedades humanas." },
  { area: "humanas", code: "H3", competency: "C1", description: "Associar as manifestações culturais do presente aos seus processos históricos." },
  { area: "humanas", code: "H4", competency: "C1", description: "Comparar pontos de vista expressos em diferentes fontes sobre determinado aspecto da cultura." },
  { area: "humanas", code: "H5", competency: "C1", description: "Identificar as manifestações ou representações da diversidade do patrimônio cultural e artístico em diferentes sociedades." },
  { area: "humanas", code: "H6", competency: "C2", description: "Interpretar diferentes representações gráficas e cartográficas dos espaços geográficos." },
  { area: "humanas", code: "H7", competency: "C2", description: "Identificar os significados histórico-geográficos das relações de poder entre as nações." },
  { area: "humanas", code: "H8", competency: "C2", description: "Analisar a ação dos estados nacionais no que se refere à dinâmica dos fluxos populacionais e no enfrentamento de problemas de ordem econômico-social." },
  { area: "humanas", code: "H9", competency: "C2", description: "Comparar o significado histórico-geográfico das organizações políticas e socioeconômicas em escala local, regional ou mundial." },
  { area: "humanas", code: "H10", competency: "C2", description: "Reconhecer a dinâmica da organização dos movimentos sociais e a importância da participação da coletividade na transformação da realidade histórico-geográfica." },
  { area: "humanas", code: "H11", competency: "C3", description: "Identificar registros de práticas de grupos sociais no tempo e no espaço." },
  { area: "humanas", code: "H12", competency: "C3", description: "Analisar o papel da justiça como instituição na organização das sociedades." },
  { area: "humanas", code: "H13", competency: "C3", description: "Analisar a atuação dos movimentos sociais que contribuíram para mudanças ou rupturas em processos de disputa pelo poder." },
  { area: "humanas", code: "H14", competency: "C3", description: "Comparar diferentes pontos de vista, presentes em textos analíticos e interpretativos, sobre situação ou fatos de natureza histórico-geográfica acerca das instituições sociais, políticas e econômicas." },
  { area: "humanas", code: "H15", competency: "C3", description: "Avaliar criticamente conflitos culturais, sociais, políticos, econômicos ou ambientais ao longo da história." },
  { area: "humanas", code: "H16", competency: "C4", description: "Identificar registros sobre o papel das técnicas e tecnologias na organização do trabalho e/ou da vida social." },
  { area: "humanas", code: "H17", competency: "C4", description: "Analisar fatores que explicam o impacto das novas tecnologias no processo de territorialização da produção." },
  { area: "humanas", code: "H18", competency: "C4", description: "Analisar diferentes processos de produção ou circulação de riquezas e suas implicações socioespaciais." },
  { area: "humanas", code: "H19", competency: "C4", description: "Reconhecer as transformações técnicas e tecnológicas que determinam as várias formas de uso e apropriação dos espaços rural e urbano." },
  { area: "humanas", code: "H20", competency: "C4", description: "Selecionar argumentos favoráveis ou contrários às modificações impostas pelas novas tecnologias à vida social e ao mundo do trabalho." },
  { area: "humanas", code: "H21", competency: "C5", description: "Identificar o papel dos meios de comunicação na construção da vida social." },
  { area: "humanas", code: "H22", competency: "C5", description: "Analisar as lutas sociais e conquistas obtidas no que se refere às mudanças nas legislações ou nas políticas públicas." },
  { area: "humanas", code: "H23", competency: "C5", description: "Analisar a importância dos valores éticos na estruturação política das sociedades." },
  { area: "humanas", code: "H24", competency: "C5", description: "Relacionar cidadania e democracia na organização das sociedades." },
  { area: "humanas", code: "H25", competency: "C5", description: "Identificar estratégias que promovam formas de inclusão social." },
  { area: "humanas", code: "H26", competency: "C6", description: "Identificar em fontes diversas o processo de ocupação dos meios físicos e as relações da vida humana com a paisagem." },
  { area: "humanas", code: "H27", competency: "C6", description: "Analisar de maneira crítica as interações da sociedade com o meio físico, levando em consideração aspectos históricos e/ou geográficos." },
  { area: "humanas", code: "H28", competency: "C6", description: "Relacionar o uso das tecnologias com os impactos socioambientais em diferentes contextos histórico-geográficos." },
  { area: "humanas", code: "H29", competency: "C6", description: "Reconhecer a função dos recursos naturais na produção do espaço geográfico, relacionando-os com as mudanças provocadas pelas ações humanas." },
  { area: "humanas", code: "H30", competency: "C6", description: "Avaliar as relações entre preservação e degradação da vida no planeta nas diferentes escalas." },

  // =========================================================================
  // CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS (C1–C8 · H1–H30)
  // =========================================================================
  { area: "natureza", code: "H1", competency: "C1", description: "Reconhecer características ou propriedades de fenômenos ondulatórios ou oscilatórios, relacionando-os a seus usos em diferentes contextos." },
  { area: "natureza", code: "H2", competency: "C1", description: "Associar a solução de problemas de comunicação, transporte, saúde ou outro, com o correspondente desenvolvimento científico e tecnológico." },
  { area: "natureza", code: "H3", competency: "C1", description: "Confrontar interpretações científicas com interpretações baseadas no senso comum, ao longo do tempo ou em diferentes culturas." },
  { area: "natureza", code: "H4", competency: "C1", description: "Avaliar propostas de intervenção no ambiente, considerando a qualidade da vida humana ou medidas de conservação, recuperação ou utilização sustentável da biodiversidade." },
  { area: "natureza", code: "H5", competency: "C2", description: "Dimensionar circuitos ou dispositivos elétricos de uso cotidiano." },
  { area: "natureza", code: "H6", competency: "C2", description: "Relacionar informações para compreender manuais de instalação ou utilização de aparelhos, ou sistemas tecnológicos de uso comum." },
  { area: "natureza", code: "H7", competency: "C2", description: "Selecionar testes de controle, parâmetros ou critérios para a comparação de materiais e produtos, tendo em vista a defesa do consumidor, a saúde do trabalhador ou a qualidade de vida." },
  { area: "natureza", code: "H8", competency: "C3", description: "Identificar etapas em processos de obtenção, transformação, utilização ou reciclagem de recursos naturais, energéticos ou matérias-primas, considerando processos biológicos, químicos ou físicos neles envolvidos." },
  { area: "natureza", code: "H9", competency: "C3", description: "Compreender a importância dos ciclos biogeoquímicos ou do fluxo energia para a vida, ou da ação de agentes ou fenômenos que podem causar alterações nesses processos." },
  { area: "natureza", code: "H10", competency: "C3", description: "Analisar perturbações ambientais, identificando fontes, transporte e/ou destino dos poluentes ou prevendo efeitos em sistemas naturais, produtivos ou sociais." },
  { area: "natureza", code: "H11", competency: "C3", description: "Reconhecer benefícios, limitações e aspectos éticos da biotecnologia, considerando estruturas e processos biológicos envolvidos em produtos biotecnológicos." },
  { area: "natureza", code: "H12", competency: "C3", description: "Avaliar impactos em ambientes naturais decorrentes de atividades sociais ou econômicas, considerando interesses contraditórios." },
  { area: "natureza", code: "H13", competency: "C4", description: "Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos." },
  { area: "natureza", code: "H14", competency: "C4", description: "Identificar padrões em fenômenos e processos vitais dos organismos, como manutenção do equilíbrio interno, defesa, relações com o ambiente, sexualidade, entre outros." },
  { area: "natureza", code: "H15", competency: "C4", description: "Interpretar modelos e experimentos para explicar fenômenos ou processos biológicos em qualquer nível de organização dos sistemas biológicos." },
  { area: "natureza", code: "H16", competency: "C4", description: "Compreender o papel da evolução na produção de padrões, processos biológicos ou na organização taxonômica dos seres vivos." },
  { area: "natureza", code: "H17", competency: "C5", description: "Relacionar informações apresentadas em diferentes formas de linguagem e representação usadas nas ciências físicas, químicas ou biológicas, como texto discursivo, gráficos, tabelas, relações matemáticas ou linguagem simbólica." },
  { area: "natureza", code: "H18", competency: "C5", description: "Relacionar propriedades físicas, químicas ou biológicas de produtos, sistemas ou procedimentos tecnológicos às finalidades a que se destinam." },
  { area: "natureza", code: "H19", competency: "C5", description: "Avaliar métodos, processos ou procedimentos das ciências naturais que contribuam para diagnosticar ou solucionar problemas de ordem social, econômica ou ambiental." },
  { area: "natureza", code: "H20", competency: "C6", description: "Caracterizar causas ou efeitos dos movimentos de partículas, substâncias, objetos ou corpos celestes." },
  { area: "natureza", code: "H21", competency: "C6", description: "Utilizar leis físicas e/ou químicas para interpretar processos naturais ou tecnológicos inseridos no contexto da termodinâmica e/ou do eletromagnetismo." },
  { area: "natureza", code: "H22", competency: "C6", description: "Compreender fenômenos decorrentes da interação entre a radiação e a matéria em suas manifestações em processos naturais ou tecnológicos, ou em suas implicações biológicas, sociais, econômicas ou ambientais." },
  { area: "natureza", code: "H23", competency: "C6", description: "Avaliar possibilidades de geração, uso ou transformação de energia em ambientes específicos, considerando implicações éticas, ambientais, sociais e/ou econômicas." },
  { area: "natureza", code: "H24", competency: "C7", description: "Utilizar códigos e nomenclatura da química para caracterizar materiais, substâncias ou transformações químicas." },
  { area: "natureza", code: "H25", competency: "C7", description: "Caracterizar materiais ou substâncias, identificando etapas, rendimentos ou implicações biológicas, sociais, econômicas ou ambientais de sua obtenção ou produção." },
  { area: "natureza", code: "H26", competency: "C7", description: "Avaliar implicações sociais, ambientais e/ou econômicas na produção ou no consumo de recursos energéticos ou minerais, identificando transformações químicas ou de energia envolvidas nesses processos." },
  { area: "natureza", code: "H27", competency: "C7", description: "Avaliar propostas de intervenção no meio ambiente aplicando conhecimentos químicos, observando riscos ou benefícios." },
  { area: "natureza", code: "H28", competency: "C8", description: "Associar características adaptativas dos organismos com seu modo de vida ou com seus limites de distribuição em diferentes ambientes, em especial em ambientes brasileiros." },
  { area: "natureza", code: "H29", competency: "C8", description: "Interpretar experimentos ou técnicas que utilizam seres vivos, analisando implicações para o ambiente, a saúde, a produção de alimentos, matérias-primas ou produtos industriais." },
  { area: "natureza", code: "H30", competency: "C8", description: "Avaliar propostas de alcance individual ou coletivo, identificando aquelas que visam à preservação e a implementação da saúde individual, coletiva ou do ambiente." },

  // =========================================================================
  // MATEMÁTICA E SUAS TECNOLOGIAS (C1–C7 · H1–H30)
  // =========================================================================
  { area: "matematica", code: "H1", competency: "C1", description: "Reconhecer, no contexto social, diferentes significados e representações dos números e operações — naturais, inteiros, racionais ou reais." },
  { area: "matematica", code: "H2", competency: "C1", description: "Identificar padrões numéricos ou princípios de contagem." },
  { area: "matematica", code: "H3", competency: "C1", description: "Resolver situação-problema envolvendo conhecimentos numéricos." },
  { area: "matematica", code: "H4", competency: "C1", description: "Avaliar a razoabilidade de um resultado numérico na construção de argumentos sobre afirmações quantitativas." },
  { area: "matematica", code: "H5", competency: "C1", description: "Avaliar propostas de intervenção na realidade utilizando conhecimentos numéricos." },
  { area: "matematica", code: "H6", competency: "C2", description: "Interpretar a localização e a movimentação de pessoas/objetos no espaço tridimensional e sua representação no espaço bidimensional." },
  { area: "matematica", code: "H7", competency: "C2", description: "Identificar características de figuras planas ou espaciais." },
  { area: "matematica", code: "H8", competency: "C2", description: "Resolver situação-problema que envolva conhecimentos geométricos de espaço e forma." },
  { area: "matematica", code: "H9", competency: "C2", description: "Utilizar conhecimentos geométricos de espaço e forma na seleção de argumentos propostos como solução de problemas do cotidiano." },
  { area: "matematica", code: "H10", competency: "C3", description: "Identificar relações entre grandezas e unidades de medida." },
  { area: "matematica", code: "H11", competency: "C3", description: "Utilizar a noção de escalas na leitura de representação de situação do cotidiano." },
  { area: "matematica", code: "H12", competency: "C3", description: "Resolver situação-problema que envolva medidas de grandezas." },
  { area: "matematica", code: "H13", competency: "C3", description: "Avaliar o resultado de uma medição na construção de um argumento consistente." },
  { area: "matematica", code: "H14", competency: "C3", description: "Avaliar proposta de intervenção na realidade utilizando conhecimentos geométricos relacionados a grandezas e medidas." },
  { area: "matematica", code: "H15", competency: "C4", description: "Identificar a relação de dependência entre grandezas." },
  { area: "matematica", code: "H16", competency: "C4", description: "Resolver situação-problema envolvendo a variação de grandezas, direta ou inversamente proporcionais." },
  { area: "matematica", code: "H17", competency: "C4", description: "Analisar informações envolvendo a variação de grandezas como recurso para a construção de argumentação." },
  { area: "matematica", code: "H18", competency: "C4", description: "Avaliar propostas de intervenção na realidade envolvendo variação de grandezas." },
  { area: "matematica", code: "H19", competency: "C5", description: "Identificar representações algébricas que expressem a relação entre grandezas." },
  { area: "matematica", code: "H20", competency: "C5", description: "Interpretar gráfico cartesiano que represente relações entre grandezas." },
  { area: "matematica", code: "H21", competency: "C5", description: "Resolver situação-problema cuja modelagem envolva conhecimentos algébricos." },
  { area: "matematica", code: "H22", competency: "C5", description: "Utilizar conhecimentos algébricos/geométricos como recurso para a construção de argumentação." },
  { area: "matematica", code: "H23", competency: "C5", description: "Avaliar propostas de intervenção na realidade utilizando conhecimentos algébricos." },
  { area: "matematica", code: "H24", competency: "C6", description: "Utilizar informações expressas em gráficos ou tabelas para fazer inferências." },
  { area: "matematica", code: "H25", competency: "C6", description: "Resolver problema com dados apresentados em tabelas ou gráficos." },
  { area: "matematica", code: "H26", competency: "C6", description: "Analisar informações expressas em gráficos ou tabelas como recurso para a construção de argumentos." },
  { area: "matematica", code: "H27", competency: "C7", description: "Calcular medidas de tendência central ou de dispersão de um conjunto de dados expressos em uma tabela de frequências de dados agrupados (não em classes) ou em gráficos." },
  { area: "matematica", code: "H28", competency: "C7", description: "Resolver situação-problema que envolva conhecimentos de estatística e probabilidade." },
  { area: "matematica", code: "H29", competency: "C7", description: "Utilizar conhecimentos de estatística e probabilidade como recurso para a construção de argumentação." },
  { area: "matematica", code: "H30", competency: "C7", description: "Avaliar propostas de intervenção na realidade utilizando conhecimentos de estatística e probabilidade." },
];
