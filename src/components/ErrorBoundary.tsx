import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  // Renderizado no lugar do conteúdo quebrado. Se omitido, some silenciosamente
  // (usar em pedaços "bônus" da tela, onde sumir é melhor do que travar a tela toda).
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  quebrou: boolean;
}

// Isola falhas de um pedaço da árvore de componentes: se algo aqui dentro
// lançar um erro durante a renderização, só esse pedaço é substituído pelo
// fallback — o resto da tela continua funcionando normalmente. Sem isso,
// qualquer erro não tratado em qualquer componente derruba a página inteira
// (tela em branco).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { quebrou: false };

  static getDerivedStateFromError() {
    return { quebrou: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro isolado pelo ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.quebrou) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
