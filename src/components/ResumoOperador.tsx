import { useMinhaEscala } from '../features/schedules/useMinhaEscala';
import { useSolicitacoesTroca } from '../features/schedules/useSolicitacoesTroca';
import { useDisponibilidadeRespondida } from '../features/availability/useDisponibilidadeRespondida';
import type { PeriodoOperacao } from '../types/database';

interface ResumoOperadorProps {
  colaboradorId: string;
  periodo: PeriodoOperacao;
}

interface ItemResumo {
  texto: string;
  tom: 'ok' | 'alerta' | 'neutro';
}

function formatarData(data: string) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

function nomeDoDia(data: string, dataInicio: string) {
  return data === dataInicio ? 'Sábado' : 'Domingo';
}

export function ResumoOperador({ colaboradorId, periodo }: ResumoOperadorProps) {
  const periodoAberto = periodo.status === 'aberto';
  const escalaAtiva = periodo.status === 'confirmado' || periodo.status === 'encerrado';

  const { respondida } = useDisponibilidadeRespondida(
    periodoAberto ? colaboradorId : null,
    periodoAberto ? periodo.id : null
  );
  const { escalas } = useMinhaEscala(
    escalaAtiva ? colaboradorId : null,
    escalaAtiva ? periodo.id : null
  );
  const { solicitacoes } = useSolicitacoesTroca();

  const proximoTurno = escalas[0] ?? null;
  const trocasPendentes = solicitacoes.filter(
    (s) => s.status === 'pendente' && !s.souSolicitante
  ).length;

  const itens: ItemResumo[] = [];

  if (periodoAberto) {
    const janela = `${formatarData(periodo.data_inicio)}–${formatarData(periodo.data_fim)}`;
    if (respondida === null) {
      itens.push({ texto: 'Verificando sua disponibilidade...', tom: 'neutro' });
    } else if (respondida) {
      itens.push({ texto: `Disponibilidade de ${janela} enviada ✓`, tom: 'ok' });
    } else {
      itens.push({
        texto: `Você ainda não enviou sua disponibilidade para ${janela}`,
        tom: 'alerta',
      });
    }
  }

  if (escalaAtiva) {
    if (proximoTurno) {
      itens.push({
        texto: `Seu turno: ${nomeDoDia(proximoTurno.data, periodo.data_inicio)} — ${
          proximoTurno.turno_nome_snapshot
        } (${proximoTurno.turno_hora_inicio_snapshot.slice(0, 5)}–${proximoTurno.turno_hora_fim_snapshot.slice(0, 5)})`,
        tom: 'ok',
      });
    } else {
      itens.push({ texto: 'Você não tem turno escalado neste fim de semana.', tom: 'neutro' });
    }
  }

  if (trocasPendentes > 0) {
    itens.push({
      texto: `${trocasPendentes} solicitação${
        trocasPendentes > 1 ? 'ões' : ''
      } de troca esperando sua resposta em "Trocas"`,
      tom: 'alerta',
    });
  }

  if (itens.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {itens.map((item, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium ${
            item.tom === 'ok'
              ? 'bg-esmeralda-light text-esmeralda-dark'
              : item.tom === 'alerta'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-50 text-slate-500'
          }`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              item.tom === 'ok'
                ? 'bg-esmeralda'
                : item.tom === 'alerta'
                  ? 'bg-amber-500'
                  : 'bg-slate-300'
            }`}
          />
          {item.texto}
        </div>
      ))}
    </div>
  );
}
