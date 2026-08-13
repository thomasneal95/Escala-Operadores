export interface Turno {
  id: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ordem_exibicao: number | null;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
}

export interface PeriodoOperacao {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'aberto' | 'em_organizacao' | 'confirmado' | 'encerrado';
}

export interface Disponibilidade {
  id: string;
  colaborador_id: string;
  periodo_id: string;
  data: string;
  turno_id: string;
  disponivel: boolean;
}

export interface Colaborador {
  id: string;
  perfil_id: string;
}