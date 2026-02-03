import { useEffect, useState } from "react";
import { getOverridesVersion, onOverridesChange } from "../services/questionOverrides";

export function useQuestionOverridesVersion(){
  const [version, setVersion] = useState(getOverridesVersion());
  useEffect(() => {
    const unsub = onOverridesChange(setVersion);
    return () => { unsub(); };
  }, []);
  return version;
}
