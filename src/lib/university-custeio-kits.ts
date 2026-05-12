export type UniversityCusteioKitItem = {
  codigoEfisco: string;
  descricaoCurta: string;
  quantidade: number;
  baseQuantidade: string;
  aplicacaoTecnica: string;
};

export type UniversityCusteioKitTemplate = {
  slug: string;
  eixo: "gestao" | "ensino" | "pesquisa" | "extensao";
  categoria: string;
  nome: string;
  objeto: string;
  finalidadeInstitucional: string;
  justificativaContratacao: string;
  justificativaQuantidade: string;
  contextoUso: string;
  orientacaoUso: string;
  cuidadosAntesEnvio: string[];
  itens: UniversityCusteioKitItem[];
};

const OFFICE_ITEMS: UniversityCusteioKitItem[] = [
  {
    codigoEfisco: "3256731",
    descricaoCurta: "Caneta esferográfica azul",
    quantidade: 120,
    baseQuantidade: "Reposição anual para atendimento, protocolo, reuniões e registros internos.",
    aplicacaoTecnica: "Material de expediente usado em assinaturas, controles, listas e registros administrativos.",
  },
  {
    codigoEfisco: "325272-8",
    descricaoCurta: "Borracha para lápis/grafite",
    quantidade: 40,
    baseQuantidade: "Reposição para conferência documental, apoio de planejamento e uso compartilhado.",
    aplicacaoTecnica: "Apoia rotinas de anotação, revisão de mapas de controle e organização de processos.",
  },
  {
    codigoEfisco: "3417310",
    descricaoCurta: "Pasta suspensa para arquivo",
    quantidade: 120,
    baseQuantidade: "Arquivo físico de processos, dossiês de contratação, documentos funcionais e controles setoriais.",
    aplicacaoTecnica: "Permite guarda organizada e rastreável de documentação administrativa.",
  },
  {
    codigoEfisco: "3420060",
    descricaoCurta: "Pasta com aba e elástico",
    quantidade: 100,
    baseQuantidade: "Montagem de processos, kits de reunião, pastas de acompanhamento e organização de documentos.",
    aplicacaoTecnica: "Evita extravio e facilita tramitação física de documentos entre setores.",
  },
  {
    codigoEfisco: "4313003",
    descricaoCurta: "Envelope tipo saco",
    quantidade: 160,
    baseQuantidade: "Expedição, arquivamento provisório e entrega de documentos a servidores e unidades.",
    aplicacaoTecnica: "Protege documentos físicos durante tramitação e armazenamento temporário.",
  },
  {
    codigoEfisco: "4806859",
    descricaoCurta: "Grampo para grampeador",
    quantidade: 30,
    baseQuantidade: "Consumo anual estimado para montagem e organização de processos administrativos.",
    aplicacaoTecnica: "Apoia agrupamento físico de documentos e peças processuais.",
  },
  {
    codigoEfisco: "328585-5",
    descricaoCurta: "Marcador permanente preto",
    quantidade: 30,
    baseQuantidade: "Identificação de caixas, envelopes, materiais e arquivos físicos.",
    aplicacaoTecnica: "Garante identificação durável de materiais de uso administrativo.",
  },
  {
    codigoEfisco: "410443-9",
    descricaoCurta: "Toner para impressora",
    quantidade: 8,
    baseQuantidade: "Estimativa anual sujeita ao parque de impressoras, volume de processos e política de impressão.",
    aplicacaoTecnica: "Mantém impressão essencial de processos, relatórios, ofícios e documentos de controle.",
  },
];

const TEACHING_ITEMS: UniversityCusteioKitItem[] = [
  {
    codigoEfisco: "3256731",
    descricaoCurta: "Caneta esferográfica azul",
    quantidade: 120,
    baseQuantidade: "Apoio a aulas, listas, avaliações, oficinas e registros de frequência.",
    aplicacaoTecnica: "Material de consumo básico para atividades didáticas e avaliativas.",
  },
  {
    codigoEfisco: "328585-5",
    descricaoCurta: "Marcador permanente preto",
    quantidade: 60,
    baseQuantidade: "Identificação de materiais didáticos, cartazes, embalagens e recursos de oficinas.",
    aplicacaoTecnica: "Permite marcação durável em atividades práticas e materiais compartilhados.",
  },
  {
    codigoEfisco: "322992-0",
    descricaoCurta: "Lápis de cera colorido",
    quantidade: 50,
    baseQuantidade: "Oficinas pedagógicas, metodologias ativas, simulações e produção de material visual.",
    aplicacaoTecnica: "Apoia atividades didáticas com representação visual, mapas e dinâmicas em grupo.",
  },
  {
    codigoEfisco: "325272-8",
    descricaoCurta: "Borracha para lápis/grafite",
    quantidade: 50,
    baseQuantidade: "Uso em sala, apoio a atividades avaliativas, exercícios e oficinas.",
    aplicacaoTecnica: "Complementa materiais de escrita e desenho usados por turmas e docentes.",
  },
  {
    codigoEfisco: "337667-2",
    descricaoCurta: "Pincel de cerda sintética",
    quantidade: 40,
    baseQuantidade: "Produção de materiais didáticos, oficinas, práticas e atividades integradoras.",
    aplicacaoTecnica: "Apoia construção de recursos pedagógicos e atividades práticas supervisionadas.",
  },
  {
    codigoEfisco: "3420060",
    descricaoCurta: "Pasta com aba e elástico",
    quantidade: 80,
    baseQuantidade: "Organização de roteiros, atividades avaliativas, materiais de aula e portfólios.",
    aplicacaoTecnica: "Facilita distribuição e guarda temporária de materiais de apoio ao ensino.",
  },
  {
    codigoEfisco: "328327-5",
    descricaoCurta: "Marcador de páginas adesivo",
    quantidade: 50,
    baseQuantidade: "Dinâmicas, leitura orientada, marcação de textos e organização de roteiros.",
    aplicacaoTecnica: "Apoia metodologias ativas, estudos dirigidos e organização de conteúdo.",
  },
  {
    codigoEfisco: "4313003",
    descricaoCurta: "Envelope tipo saco",
    quantidade: 100,
    baseQuantidade: "Guarda e distribuição de avaliações, exercícios, documentos de estágio e materiais de turma.",
    aplicacaoTecnica: "Protege documentos e materiais impressos utilizados em atividades acadêmicas.",
  },
];

const LAB_ITEMS: UniversityCusteioKitItem[] = [
  {
    codigoEfisco: "13563-1",
    descricaoCurta: "Luva cirúrgica descartável",
    quantidade: 400,
    baseQuantidade: "Consumo por usuário/procedimento em aulas práticas, pesquisa e extensão em saúde.",
    aplicacaoTecnica: "EPI descartável para proteção em manipulação e procedimentos laboratoriais.",
  },
  {
    codigoEfisco: "869473",
    descricaoCurta: "Luva descartável para procedimento",
    quantidade: 600,
    baseQuantidade: "Uso por turnos de laboratório e atividades de manuseio de materiais.",
    aplicacaoTecnica: "Proteção de mãos em rotinas não estéreis e manipulação de amostras.",
  },
  {
    codigoEfisco: "47119-4",
    descricaoCurta: "Máscara cirúrgica descartável",
    quantidade: 600,
    baseQuantidade: "Distribuição por aula, ensaio, atendimento simulado ou procedimento com risco de exposição.",
    aplicacaoTecnica: "Barreira de proteção respiratória em atividades laboratoriais e práticas supervisionadas.",
  },
  {
    codigoEfisco: "264367-7",
    descricaoCurta: "Álcool etílico a 70%",
    quantidade: 90,
    baseQuantidade: "Reposição para higienização de bancadas, mãos, superfícies e materiais de uso compartilhado.",
    aplicacaoTecnica: "Assepsia e redução de risco de contaminação em rotinas práticas.",
  },
  {
    codigoEfisco: "2327740",
    descricaoCurta: "Álcool etílico absoluto P.A.",
    quantidade: 20,
    baseQuantidade: "Uso controlado em protocolos de laboratório, conforme plano de trabalho e responsável técnico.",
    aplicacaoTecnica: "Insumo para preparo, limpeza técnica ou etapas específicas de ensaios.",
  },
  {
    codigoEfisco: "280119",
    descricaoCurta: "Pipeta de vidro graduada",
    quantidade: 80,
    baseQuantidade: "Dimensionamento por bancadas, grupos de estudantes e protocolos ativos.",
    aplicacaoTecnica: "Medição e transferência de volumes em preparo de soluções e ensaios.",
  },
  {
    codigoEfisco: "1629247",
    descricaoCurta: "Pipeta Pasteur plástica",
    quantidade: 500,
    baseQuantidade: "Consumo descartável por amostra, aula prática ou rotina experimental.",
    aplicacaoTecnica: "Transferência simples de pequenos volumes em rotinas de laboratório.",
  },
  {
    codigoEfisco: "301892",
    descricaoCurta: "Ponteira plástica para micropipeta",
    quantidade: 1200,
    baseQuantidade: "Uso descartável por amostra para reduzir contaminação cruzada.",
    aplicacaoTecnica: "Insumo de precisão para micropipetagem em ensaios e preparo de amostras.",
  },
  {
    codigoEfisco: "281913",
    descricaoCurta: "Placa de Petri",
    quantidade: 300,
    baseQuantidade: "Dimensionamento por turmas, cultivos, aulas práticas e projetos ativos.",
    aplicacaoTecnica: "Cultivo, preparo, observação e análise de amostras microbiológicas.",
  },
  {
    codigoEfisco: "4837819",
    descricaoCurta: "Microtubo plástico tipo Eppendorf 1,5 ml",
    quantidade: 800,
    baseQuantidade: "Armazenamento e processamento de amostras por ensaio, aula ou projeto.",
    aplicacaoTecnica: "Acondicionamento de amostras e reagentes em pequeno volume.",
  },
  {
    codigoEfisco: "4837827",
    descricaoCurta: "Microtubo plástico tipo Eppendorf 2,0 ml",
    quantidade: 600,
    baseQuantidade: "Uso por protocolos que exigem maior volume de amostra ou solução.",
    aplicacaoTecnica: "Apoia processamento, armazenamento temporário e organização de amostras.",
  },
  {
    codigoEfisco: "381373",
    descricaoCurta: "Tubo tipo Eppendorf",
    quantidade: 600,
    baseQuantidade: "Reposição para aulas e rotinas de pesquisa com amostras múltiplas.",
    aplicacaoTecnica: "Armazenamento e processamento de amostras em procedimentos laboratoriais.",
  },
];

const EVENT_ITEMS: UniversityCusteioKitItem[] = [
  {
    codigoEfisco: "607717-0",
    descricaoCurta: "Serviço de confecção de faixa/banner",
    quantidade: 6,
    baseQuantidade: "Sinalização institucional para locais de evento, campanhas e ações externas.",
    aplicacaoTecnica: "Comunicação visual para identificação da ação e orientação do público.",
  },
  {
    codigoEfisco: "5710898",
    descricaoCurta: "Lona para impressão digital/banner",
    quantidade: 6,
    baseQuantidade: "Produção de peças visuais para ações com público externo ou múltiplos espaços.",
    aplicacaoTecnica: "Divulgação, sinalização e organização visual de eventos acadêmicos.",
  },
  {
    codigoEfisco: "5674352",
    descricaoCurta: "Suporte para banner",
    quantidade: 4,
    baseQuantidade: "Apoio a banners em auditórios, recepção, feiras e ações itinerantes.",
    aplicacaoTecnica: "Permite exposição estável e reutilizável de material visual da ação.",
  },
  {
    codigoEfisco: "3420060",
    descricaoCurta: "Pasta com aba e elástico",
    quantidade: 120,
    baseQuantidade: "Entrega de materiais, certificados, roteiros e fichas a participantes e equipe.",
    aplicacaoTecnica: "Organização individual de documentos e materiais de apoio do evento.",
  },
  {
    codigoEfisco: "3256731",
    descricaoCurta: "Caneta esferográfica azul",
    quantidade: 150,
    baseQuantidade: "Credenciamento, listas de presença, oficinas e registros da ação.",
    aplicacaoTecnica: "Apoia registros manuais e atividades participativas.",
  },
  {
    codigoEfisco: "4313003",
    descricaoCurta: "Envelope tipo saco",
    quantidade: 120,
    baseQuantidade: "Organização de documentos, certificados, fichas e materiais impressos.",
    aplicacaoTecnica: "Guarda e proteção de materiais distribuídos ou recolhidos na ação.",
  },
  {
    codigoEfisco: "328327-5",
    descricaoCurta: "Marcador de páginas adesivo",
    quantidade: 60,
    baseQuantidade: "Dinâmicas, oficinas, leitura guiada e organização de atividades em grupo.",
    aplicacaoTecnica: "Apoia metodologias participativas e organização de conteúdos.",
  },
  {
    codigoEfisco: "5900476",
    descricaoCurta: "Copo descartável de papel biodegradável",
    quantidade: 800,
    baseQuantidade: "Apoio a hidratação e recepção em eventos, conforme público e duração.",
    aplicacaoTecnica: "Material de consumo para atendimento ao público em atividades institucionais.",
  },
];

export const UNIVERSITY_CUSTEIO_KIT_TEMPLATES: UniversityCusteioKitTemplate[] = [
  {
    slug: "custeio-gestao-administrativa",
    eixo: "gestao",
    categoria: "Gestao",
    nome: "DFD modelo - Custeio de gestão administrativa",
    objeto:
      "Aquisição de materiais de consumo para funcionamento administrativo, protocolo, apoio às chefias, arquivo, reuniões internas e rotinas de atendimento do setor.",
    finalidadeInstitucional:
      "Garantir continuidade das atividades-meio da unidade, com materiais básicos para tramitação documental, atendimento, organização de processos e suporte às decisões administrativas.",
    justificativaContratacao:
      "A unidade mantém fluxo contínuo de documentos, reuniões, expedientes, atendimentos presenciais e demandas de apoio à gestão acadêmica e administrativa. A ausência de materiais básicos de expediente compromete a organização de processos, a resposta a solicitações internas, a guarda de documentos e a capacidade de registrar atos administrativos. A contratação proposta limita-se a itens de consumo, de uso recorrente, sem inclusão de bens permanentes ou itens de capital.",
    justificativaQuantidade:
      "As quantidades foram estimadas para um setor administrativo de médio porte, considerando ciclo anual de planejamento, número de servidores em atividade, volume de processos, necessidade de reposição de estoque mínimo e consumo médio em reuniões, protocolo, arquivo e atendimento. O solicitante deve ajustar os quantitativos conforme estoque atual, histórico de saída no almoxarifado, número de usuários do setor e eventuais atividades extraordinárias previstas.",
    contextoUso:
      "Uso em direção, coordenação administrativa, secretaria, protocolo, gestão de pessoas, planejamento, patrimônio, almoxarifado e demais áreas administrativas com tramitação documental.",
    orientacaoUso:
      "Antes de enviar, informe setor solicitante, estoque atual, consumo mensal aproximado, número de servidores atendidos e justificativa para itens com quantidade acima do consumo histórico.",
    cuidadosAntesEnvio: [
      "Remover equipamentos, mobiliário e qualquer item de capital.",
      "Conferir se toner é compatível com o parque de impressoras do setor.",
      "Separar DFD distinta caso haja serviço continuado ou item de natureza diferente.",
    ],
    itens: OFFICE_ITEMS,
  },
  {
    slug: "custeio-gestao-almoxarifado-patrimonio",
    eixo: "gestao",
    categoria: "Gestao",
    nome: "DFD modelo - Custeio de almoxarifado, patrimônio e arquivo",
    objeto:
      "Aquisição de materiais de consumo para identificação, guarda, controle, movimentação documental e apoio às rotinas de almoxarifado, patrimônio e arquivo setorial.",
    finalidadeInstitucional:
      "Reforçar a rastreabilidade de documentos, materiais e bens sob responsabilidade administrativa, reduzindo perdas, retrabalho e desorganização física de processos.",
    justificativaContratacao:
      "As atividades de almoxarifado, patrimônio e arquivo exigem identificação de volumes, organização de pastas, montagem de processos, controle de movimentação e guarda física de documentos. A falta desses materiais prejudica a rastreabilidade de entradas e saídas, dificulta auditorias e aumenta risco de extravio de documentos. A demanda é de custeio, restrita a materiais consumíveis e de apoio operacional.",
    justificativaQuantidade:
      "As quantidades tomam como referência a necessidade de organização de caixas, pastas, processos, etiquetas manuais e documentos de movimentação ao longo do exercício. Devem ser ajustadas pela quantidade de bens inventariados, volume de processos arquivados, número de requisições de almoxarifado e estoque disponível.",
    contextoUso:
      "Uso por setores de patrimônio, almoxarifado, arquivo, protocolo, planejamento e coordenação administrativa.",
    orientacaoUso:
      "Indique a rotina atendida, quantidade de processos/bens estimada, estoque físico existente e se o material será usado em inventário, arquivo permanente ou movimentação ordinária.",
    cuidadosAntesEnvio: [
      "Não incluir bens patrimoniais, leitores, impressoras ou mobiliário.",
      "Vincular a demanda ao setor responsável pelo controle físico.",
      "Conferir compatibilidade de materiais com o método de arquivamento adotado.",
    ],
    itens: [
      OFFICE_ITEMS[2],
      OFFICE_ITEMS[3],
      OFFICE_ITEMS[4],
      OFFICE_ITEMS[5],
      OFFICE_ITEMS[6],
      TEACHING_ITEMS[6],
      OFFICE_ITEMS[0],
      OFFICE_ITEMS[1],
    ],
  },
  {
    slug: "custeio-ensino-sala-aula",
    eixo: "ensino",
    categoria: "Ensino",
    nome: "DFD modelo - Custeio de ensino, sala de aula e atividades avaliativas",
    objeto:
      "Aquisição de materiais de consumo para aulas, atividades avaliativas, oficinas pedagógicas, metodologias ativas e apoio didático em salas e espaços de aprendizagem.",
    finalidadeInstitucional:
      "Apoiar a execução regular dos componentes curriculares, atividades de avaliação, oficinas e práticas pedagógicas que dependem de materiais consumíveis.",
    justificativaContratacao:
      "As atividades de ensino presenciais e práticas demandam materiais de escrita, organização, identificação, produção de recursos didáticos e apoio a avaliações. O uso desses itens está vinculado a disciplinas, turmas, oficinas, atividades integradoras e práticas supervisionadas. A ausência dos materiais limita a aplicação de metodologias ativas, a organização de avaliações e a produção de instrumentos de apoio ao processo ensino-aprendizagem.",
    justificativaQuantidade:
      "Os quantitativos foram dimensionados para atendimento de turmas e componentes curriculares em ciclo semestral ou anual, considerando número estimado de estudantes, docentes, turmas, carga horária prática, frequência de oficinas e materiais já disponíveis. Cada item deve ser ajustado conforme plano de ensino, calendário acadêmico e estoque existente.",
    contextoUso:
      "Uso em sala de aula, sala docente, coordenações de curso, oficinas, monitorias, atividades avaliativas e práticas de ensino.",
    orientacaoUso:
      "Informe disciplinas ou atividades atendidas, quantidade de turmas, número estimado de estudantes, período de uso e responsável pela distribuição.",
    cuidadosAntesEnvio: [
      "Não misturar itens de capital como projetores, televisores, computadores ou mobiliário.",
      "Evitar quantidades genéricas sem relação com turma, carga horária ou plano de ensino.",
      "Separar laboratório quando houver insumos técnicos específicos.",
    ],
    itens: TEACHING_ITEMS,
  },
  {
    slug: "custeio-ensino-laboratorio-habilidades",
    eixo: "ensino",
    categoria: "Ensino",
    nome: "DFD modelo - Custeio de laboratório de ensino e habilidades",
    objeto:
      "Aquisição de materiais de consumo para aulas práticas, simulações, treinamento de habilidades, biossegurança e organização de bancadas em laboratório de ensino.",
    finalidadeInstitucional:
      "Viabilizar aulas práticas e simulações com segurança, reposição de insumos descartáveis e organização de materiais utilizados por estudantes e docentes.",
    justificativaContratacao:
      "Laboratórios de ensino e habilidades utilizam insumos descartáveis em cada aula, turma ou procedimento simulado. A reposição regular é necessária para manter condições mínimas de biossegurança, higienização, manipulação e organização das atividades práticas. A demanda apoia ensino e treinamento supervisionado, sem aquisição de equipamentos permanentes.",
    justificativaQuantidade:
      "As quantidades foram estimadas por turma, turno de laboratório, número de estudantes por bancada, frequência de aulas práticas e consumo descartável por procedimento. O solicitante deve ajustar conforme plano semestral de práticas, estoque atual, número de turmas e protocolos efetivamente executados.",
    contextoUso:
      "Uso em laboratórios de ensino, pesquisa, extensão e habilidades, especialmente em cursos da área da saúde e atividades práticas supervisionadas.",
    orientacaoUso:
      "Informe disciplina, período, número de turmas, quantidade média de estudantes por prática, responsável técnico e estoque atual dos principais EPIs e insumos.",
    cuidadosAntesEnvio: [
      "Separar reagentes, insumos laboratoriais e serviços em DFDs diferentes quando a natureza exigir.",
      "Não incluir equipamentos como micropipetas, centrífugas, freezers ou mobiliário.",
      "Validar com responsável técnico do laboratório antes do envio à chefia.",
    ],
    itens: [
      LAB_ITEMS[0],
      LAB_ITEMS[1],
      LAB_ITEMS[2],
      LAB_ITEMS[3],
      LAB_ITEMS[6],
      LAB_ITEMS[7],
      TEACHING_ITEMS[5],
      OFFICE_ITEMS[6],
    ],
  },
  {
    slug: "custeio-pesquisa-laboratorio",
    eixo: "pesquisa",
    categoria: "Pesquisa",
    nome: "DFD modelo - Custeio de pesquisa laboratorial",
    objeto:
      "Aquisição de materiais de consumo laboratoriais para atividades de pesquisa, iniciação científica, pós-graduação, processamento de amostras e execução de projetos cadastrados.",
    finalidadeInstitucional:
      "Assegurar disponibilidade de insumos consumíveis para execução de protocolos de pesquisa, manutenção de rotinas experimentais e atendimento a planos de trabalho aprovados.",
    justificativaContratacao:
      "Projetos de pesquisa exigem reposição contínua de insumos descartáveis para coleta, preparo, armazenamento, manipulação e análise de amostras. A falta desses materiais pode interromper cronogramas, comprometer validade experimental e inviabilizar atividades de iniciação científica, pós-graduação e produção acadêmica. O kit abrange apenas itens consumíveis, devendo estar vinculado a projeto, linha de pesquisa, laboratório ou plano de trabalho.",
    justificativaQuantidade:
      "Os quantitativos consideram número de projetos ativos, usuários autorizados, amostras previstas, ensaios por período, perdas técnicas, validade de insumos e estoque atual. Devem ser ajustados com base em protocolos aprovados, consumo por ensaio e cronograma do projeto.",
    contextoUso:
      "Uso em laboratórios de pesquisa, microbiologia, parasitologia, anatomofisiologia, saúde coletiva, ruralidades, processos psicossociais e demais linhas com manipulação de amostras.",
    orientacaoUso:
      "Informe projeto, coordenador, laboratório, equipe usuária, protocolo/ensaio, amostras previstas, periodicidade de uso e estoque atual.",
    cuidadosAntesEnvio: [
      "Não incluir equipamentos permanentes ou manutenção de equipamento.",
      "Separar reagentes controlados ou itens com exigência técnica específica quando necessário.",
      "Justificar itens com validade curta com base no cronograma de execução.",
    ],
    itens: LAB_ITEMS,
  },
  {
    slug: "custeio-pesquisa-campo-coleta",
    eixo: "pesquisa",
    categoria: "Pesquisa",
    nome: "DFD modelo - Custeio de pesquisa de campo e coleta",
    objeto:
      "Aquisição de materiais de consumo para coleta, identificação, armazenamento temporário, registro e organização de atividades de pesquisa de campo.",
    finalidadeInstitucional:
      "Dar suporte material a projetos que realizam coleta de dados, amostras, observação em campo, aplicação de instrumentos e organização de evidências.",
    justificativaContratacao:
      "Pesquisas de campo demandam materiais consumíveis para identificação, registro, acondicionamento temporário, organização de formulários, higienização e proteção básica dos participantes da equipe. A ausência desses materiais prejudica a padronização da coleta, aumenta risco de perda de dados e compromete cronogramas de execução. A demanda deve estar vinculada a projeto ou plano de trabalho aprovado.",
    justificativaQuantidade:
      "As quantidades foram estimadas por número de saídas de campo, integrantes da equipe, participantes/amostras previstos, instrumentos aplicados e necessidade de organização documental. O solicitante deve ajustar de acordo com cronograma, território, duração das coletas e estoque disponível.",
    contextoUso:
      "Uso em pesquisas de campo, extensão investigativa, coleta de dados em comunidade, visitas técnicas, atividades em território e estudos observacionais.",
    orientacaoUso:
      "Informe projeto, locais de coleta, número de saídas, público/amostras estimados, equipe envolvida e responsável pela guarda dos materiais.",
    cuidadosAntesEnvio: [
      "Separar diárias, passagens, transporte ou serviços em DFD própria.",
      "Não incluir equipamento de capital para coleta.",
      "Validar necessidade de EPIs conforme risco da atividade.",
    ],
    itens: [
      OFFICE_ITEMS[0],
      OFFICE_ITEMS[3],
      OFFICE_ITEMS[4],
      OFFICE_ITEMS[6],
      TEACHING_ITEMS[6],
      LAB_ITEMS[1],
      LAB_ITEMS[2],
      LAB_ITEMS[3],
    ],
  },
  {
    slug: "custeio-extensao-eventos",
    eixo: "extensao",
    categoria: "Extensao",
    nome: "DFD modelo - Custeio de extensão, eventos e ações comunitárias",
    objeto:
      "Aquisição e contratação de itens de custeio para ações de extensão, eventos acadêmicos, campanhas educativas, oficinas e atividades de interação com a comunidade.",
    finalidadeInstitucional:
      "Viabilizar a execução de ações extensionistas com comunicação visual, acolhimento, organização de participantes, registro de presença e entrega de materiais.",
    justificativaContratacao:
      "A extensão universitária exige materiais de consumo e serviços de apoio para divulgação, identificação, organização, condução de oficinas, registros e atendimento ao público participante. Sem esses itens, há prejuízo na orientação do público, na padronização visual, na logística de atividades e no controle documental da ação. O kit é voltado a custeio e deve estar vinculado a programa, projeto, curso, campanha ou evento.",
    justificativaQuantidade:
      "As quantidades foram dimensionadas para ação de pequeno a médio porte, considerando público estimado, número de encontros, equipe executora, locais de realização, material já disponível e necessidade de sinalização. Ajuste os itens conforme porte do evento, duração e reaproveitamento possível.",
    contextoUso:
      "Uso em auditórios, salas, espaços de convivência, ações externas, campanhas em território, oficinas comunitárias e eventos acadêmicos.",
    orientacaoUso:
      "Informe projeto de extensão, público-alvo, local, data prevista, número de participantes, equipe executora e responsável pela guarda dos materiais remanescentes.",
    cuidadosAntesEnvio: [
      "Separar contratação de alimentação, transporte ou estrutura quando houver natureza própria.",
      "Remover itens que não se aplicam ao porte da ação.",
      "Conferir se a comunicação visual segue identidade institucional.",
    ],
    itens: EVENT_ITEMS,
  },
  {
    slug: "custeio-extensao-campanha-saude",
    eixo: "extensao",
    categoria: "Extensao",
    nome: "DFD modelo - Custeio de campanha de saúde e educação comunitária",
    objeto:
      "Aquisição de materiais de consumo para campanhas de saúde, educação comunitária, acolhimento, oficinas práticas e ações integradas de ensino, pesquisa e extensão.",
    finalidadeInstitucional:
      "Apoiar ações com comunidade externa que exigem organização de público, biossegurança básica, registro de atendimento e materiais de orientação.",
    justificativaContratacao:
      "Campanhas e ações comunitárias exigem preparação logística, sinalização, registro de participantes, organização de materiais e disponibilidade de insumos descartáveis quando há orientação, demonstração ou prática supervisionada em saúde. A ausência desses materiais reduz qualidade do atendimento, dificulta comprovação da atividade e limita o alcance da ação extensionista.",
    justificativaQuantidade:
      "As quantidades consideram público estimado, número de estações de atendimento, equipe envolvida, duração da campanha, atividades práticas previstas e necessidade de reposição para ações seriadas. Devem ser ajustadas por calendário, local, estoque atual e perfil de risco da atividade.",
    contextoUso:
      "Uso em campanhas educativas, feiras de saúde, ações em escolas, comunidades, unidades parceiras e atividades de educação permanente.",
    orientacaoUso:
      "Informe nome da campanha, público estimado, locais, datas, equipe, atividades previstas e se haverá demonstração prática ou atendimento supervisionado.",
    cuidadosAntesEnvio: [
      "Separar serviços gráficos, alimentação e transporte quando exigirem DFD própria.",
      "Validar EPIs com responsável técnico quando houver contato com público ou material biológico.",
      "Não incluir equipamentos permanentes, macas, tendas ou mobiliário.",
    ],
    itens: [
      EVENT_ITEMS[0],
      EVENT_ITEMS[4],
      EVENT_ITEMS[5],
      EVENT_ITEMS[6],
      EVENT_ITEMS[7],
      LAB_ITEMS[1],
      LAB_ITEMS[2],
      LAB_ITEMS[3],
      TEACHING_ITEMS[5],
    ],
  },
  {
    slug: "custeio-gestao-higiene-apoio",
    eixo: "gestao",
    categoria: "Gestao",
    nome: "DFD modelo - Custeio de higiene, apoio operacional e áreas comuns",
    objeto:
      "Aquisição de materiais de consumo para apoio operacional, higienização leve, áreas comuns, salas de atendimento e manutenção das condições básicas de uso dos espaços.",
    finalidadeInstitucional:
      "Garantir condições mínimas de funcionamento e acolhimento em espaços administrativos, acadêmicos e de convivência, com insumos consumíveis de apoio.",
    justificativaContratacao:
      "A rotina de áreas comuns, salas de atendimento, auditórios, biblioteca, cantina institucional e espaços de convivência exige materiais consumíveis de higiene, limpeza leve e apoio ao uso coletivo. A demanda contribui para organização, conservação e atendimento básico aos usuários, sem incluir contratação continuada de limpeza ou aquisição de equipamentos.",
    justificativaQuantidade:
      "Os quantitativos foram estimados considerando circulação de pessoas, número de ambientes atendidos, frequência de uso, eventos previstos e consumo mensal. Devem ser ajustados por estoque atual, área física, calendário acadêmico e existência de contrato específico que já cubra parte dos insumos.",
    contextoUso:
      "Uso em biblioteca, auditório, cantina, espaço de convivência, salas administrativas, sanitários e áreas de atendimento ao público.",
    orientacaoUso:
      "Informe espaços atendidos, circulação média, frequência de reposição, estoque atual e se há contrato de limpeza ou fornecimento que cubra itens semelhantes.",
    cuidadosAntesEnvio: [
      "Não duplicar itens já cobertos por contrato vigente.",
      "Separar serviço continuado de limpeza em DFD própria.",
      "Não incluir equipamentos como bebedouros, cafeteiras, dispensers ou mobiliário.",
    ],
    itens: [
      EVENT_ITEMS[7],
      {
        codigoEfisco: "6048269",
        descricaoCurta: "Detergente líquido clorado desengordurante",
        quantidade: 40,
        baseQuantidade: "Reposição para higienização leve e apoio operacional de áreas comuns.",
        aplicacaoTecnica: "Insumo de limpeza para superfícies e materiais de uso coletivo.",
      },
      {
        codigoEfisco: "6048528",
        descricaoCurta: "Detergente desengraxante biodegradável",
        quantidade: 30,
        baseQuantidade: "Uso em apoio operacional quando houver necessidade de limpeza de maior aderência.",
        aplicacaoTecnica: "Apoio a higienização de superfícies e materiais em áreas de uso recorrente.",
      },
      {
        codigoEfisco: "6053025",
        descricaoCurta: "Detergente líquido neutro",
        quantidade: 60,
        baseQuantidade: "Consumo mensal estimado para copa, apoio e limpeza leve de materiais.",
        aplicacaoTecnica: "Material de consumo para higienização simples e uso operacional.",
      },
      {
        codigoEfisco: "592721-8",
        descricaoCurta: "Papel toalha interfolhado",
        quantidade: 80,
        baseQuantidade: "Reposição para sanitários, laboratórios, salas de atendimento e áreas comuns.",
        aplicacaoTecnica: "Apoia higiene das mãos e limpeza rápida de superfícies.",
      },
      {
        codigoEfisco: "102513-9",
        descricaoCurta: "Papel toalha em bobina",
        quantidade: 40,
        baseQuantidade: "Reposição para ambientes de maior circulação ou uso recorrente.",
        aplicacaoTecnica: "Insumo de higiene para áreas comuns e espaços de atendimento.",
      },
      OFFICE_ITEMS[4],
      OFFICE_ITEMS[6],
    ],
  },
];

export function buildCusteioKitDescription(template: UniversityCusteioKitTemplate) {
  const itemLines = template.itens
    .map(
      (item, index) =>
        `${index + 1}. ${item.descricaoCurta} - quantidade sugerida ${item.quantidade}. Base: ${item.baseQuantidade} Aplicação: ${item.aplicacaoTecnica}`,
    )
    .join("\n");
  const cautions = template.cuidadosAntesEnvio.map((item) => `- ${item}`).join("\n");

  return [
    `Objeto da DFD:\n${template.objeto}`,
    `Finalidade institucional:\n${template.finalidadeInstitucional}`,
    `Justificativa da necessidade:\n${template.justificativaContratacao}`,
    `Base de cálculo e dimensionamento:\n${template.justificativaQuantidade}`,
    `Contexto de uso:\n${template.contextoUso}`,
    `Orientação ao solicitante:\n${template.orientacaoUso}`,
    `Cuidados antes do envio:\n${cautions}`,
    "Natureza: custeio. Não misturar com itens de capital na mesma DFD.",
    `Itens sugeridos:\n${itemLines}`,
  ].join("\n\n");
}
