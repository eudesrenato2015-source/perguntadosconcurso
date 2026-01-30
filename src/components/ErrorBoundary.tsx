import React from "react";

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State>{
  state: State = { error: null };

  static getDerivedStateFromError(error: Error){
    return { error };
  }

  componentDidCatch(error: Error){
    console.error("[app] render error", error);
  }

  render(){
    if (this.state.error){
      return (
        <div style={{ padding: 16 }}>
          <div className="h2">Algo deu errado</div>
          <div className="sub" style={{ marginTop: 6 }}>
            {this.state.error.message || "Falha inesperada na tela."}
          </div>
          <button className="btn btnPrimary" style={{ marginTop: 10 }} onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

