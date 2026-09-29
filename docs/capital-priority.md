# Pontuação de capital na consolidação

Versão: `capital-two-level-v1`. A regra vale apenas para itens de GND 4 em DFDs elegíveis à consolidação. Cada campus forma uma carteira independente; o total de pedidos não é tratado como orçamento disponível.

Para cada necessidade de valor total `V`, usam-se os demais itens válidos do mesmo campus para calcular `Q1`, `Q3` e `P90`. A referência é `F = max(Q3 + 1,5 × (Q3 − Q1), P90)`. Com `T` igual ao total solicitado de capital no campus, `D = (V/T) × max(0, ln(V/F))` e `P = 112 × (1 − exp(−4D))`.

O mesmo cálculo é feito na unidade solicitante. O componente local só entra quando há mais de cinco necessidades válidas na unidade. Sua confiança é `c = clamp((n − 5)/15, 0, 1)` e o acréscimo é `c × min(28, max(0, P_unidade − P_campus))`. A penalidade final é limitada a 112 pontos.

A nota exibida é `clamp(14 × criticidade × prioridade + (Pareto da chefia ? 28 : 0) − penalidade, 0, 280)`, com dois decimais. Como esta versão implementa apenas a penalidade sistêmica, seu máximo efetivo é 252 pontos; os 28 pontos restantes da escala de 280 dependem de um bônus de mérito futuro, que não foi inferido sem dados estruturados. Criticidade e prioridade usam os quatro níveis atualmente registrados pela chefia. Os controles dessas avaliações ficam somente para leitura na linha de capital da consolidação.

Itens sem valor positivo, campus, avaliação humana completa ou com menos de seis necessidades válidas no campus ficam pendentes, sem nota zero. A exportação leva versão, componentes, referências e motivo de pendência. Itens não classificados como capital mantêm o cálculo anterior.

A tela consolida itens de capital com mesmo campus, unidade solicitante, GND, código e avaliação da chefia. Isso reúne valores potencialmente fracionados sob o mesmo código sem presumir que bens de códigos diferentes componham uma única necessidade. A vinculação entre microcomputador e monitor, por exemplo, requer confirmação explícita antes de um cálculo conjunto. A regra mede concentração na carteira; não atesta sobrepreço e não aplica uma restrição orçamentária ainda desconhecida.

O cálculo é refeito quando a carteira é carregada e não cria um registro persistente de cada execução. Uma versão futura precisará de vínculo estruturado de necessidades e de snapshots persistidos caso o resultado passe a fundamentar decisão administrativa formal.
