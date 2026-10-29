import { useState } from 'react';
import { useInstalarApp } from '../hooks/useInstalarApp';

const CHAVE_DISPENSADO = 'jornada360-instalar-dispensado-ate';
const DIAS_DISPENSADO = 30;

function dispensadoAgora() {
  try {
    return Number(localStorage.getItem(CHAVE_DISPENSADO) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

// Card da tela inicial que convida a instalar o Jornada 360 como app no
// celular (ou computador). Some quando o app já está instalado, quando o
// navegador não permite instalar ou por 30 dias depois de "Agora não".
export function InstalarAppCard() {
  const { modo, instalar } = useInstalarApp();
  const [dispensado, setDispensado] = useState(dispensadoAgora);
  const [mostrarPassos, setMostrarPassos] = useState(false);

  if (!modo || dispensado) return null;

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, String(Date.now() + DIAS_DISPENSADO * 86_400_000));
    } catch {
      // sem armazenamento: some só nesta visita
    }
    setDispensado(true);
  }

  return (
    <div className="mb-6 rounded-lg border border-ceruleo/30 bg-ceruleo-light p-4">
      <div className="flex items-start gap-3">
        <img src="/icone-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-tinta">Instale o app Jornada 360</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Abra direto da tela inicial do celular, em tela cheia, sem procurar o site.
          </p>

          {mostrarPassos && modo === 'ios' && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>
                Toque no botão <strong>Compartilhar</strong> do navegador (o quadrado com a seta para cima).
              </li>
              <li>
                Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                Toque em <strong>Adicionar</strong>. O ícone do Jornada 360 aparece na sua tela inicial.
              </li>
            </ol>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            {modo === 'prompt' ? (
              <button
                onClick={instalar}
                className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
              >
                Instalar app
              </button>
            ) : (
              !mostrarPassos && (
                <button
                  onClick={() => setMostrarPassos(true)}
                  className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
                >
                  Como instalar
                </button>
              )
            )}
            <button
              onClick={dispensar}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/60"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
