import React, { useEffect, useState } from "react";
export default function UpdateToast(){
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFn, setUpdateFn] = useState<null | (()=>void)>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try{
        const mod: any = await import("virtual:pwa-register");
        const { registerSW } = mod;
        const updateSW = registerSW({
          onNeedRefresh(){
            if (!mounted) return;
            setNeedRefresh(true);
            setUpdateFn(() => updateSW);
          },
          onOfflineReady(){ /* noop */ }
        });
      }catch{}
    })();
    return () => { mounted = false; };
  }, []);
  if (!needRefresh) return null;
  return (
    <div className="toastWrap">
      <div className="toast" role="status" aria-live="polite">
        <div>
          <div style={{ fontWeight: 800 }}>Atualização disponível</div>
          <div style={{ color: "var(--ink-500)", fontSize: 13 }}>Clique para recarregar e aplicar.</div>
        </div>
        <button className="btn btnPrimary" onClick={() => updateFn?.()}>Recarregar</button>
      </div>
    </div>
  );
}
