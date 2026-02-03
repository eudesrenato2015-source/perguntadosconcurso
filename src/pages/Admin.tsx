import React, { useEffect, useMemo, useState } from "react";
import type { Discipline, ExamStyle, Question, QType } from "../types";
import { getAllQuestions } from "../services/packs";
import { getAuthUser, onAuthChange, type AuthUser } from "../services/auth";
import { useQuestionOverridesVersion } from "../hooks/useQuestionOverrides";
import { deleteQuestionOverride, getOverride, upsertQuestionOverride, deleteQuestionCustom, upsertQuestionCustom, getCustomQuestions, type QuestionPatch } from "../services/questionOverrides";
import { DISCIPLINES } from "../data/disciplines";

const ADMIN_EMAIL = "eudesrenato2015@gmail.com";
const styles: ("Nenhum"|ExamStyle)[] = ["Nenhum","CEBRASPE","CESPE","FGV","VUNESP","FCC","IBFC","QUADRIX","AOCP"];

export default function Admin(){
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<Discipline | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDiscipline, setBulkDiscipline] = useState<Discipline | "">("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const overridesVersion = useQuestionOverridesVersion();

  useEffect(() => {
    getAuthUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  const isAdmin = (user?.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const all = useMemo(() => getAllQuestions(), [overridesVersion]);
  const customs = useMemo(() => getCustomQuestions(), [overridesVersion]);
  const customIds = useMemo(() => new Set(customs.map(q => q.id)), [customs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(item => {
      if (discipline !== "Todas" && item.discipline !== discipline) return false;
      if (!q) return true;
      const blob = (item.statement + " " + item.subject + " " + item.topic).toLowerCase();
      return blob.includes(q);
    });
  }, [all, query, discipline]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return all.find(q => q.id === selectedId) ?? null;
  }, [all, selectedId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearSelection = () => setSelectedIds([]);

  const applyBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      for (const id of selectedIds){
        const q = all.find(item => item.id === id);
        if (!q) continue;
        const patch: QuestionPatch = {
          id,
          discipline: bulkDiscipline ? bulkDiscipline : q.discipline,
          subject: bulkSubject.trim() ? bulkSubject.trim() : q.subject,
          topic: bulkTopic.trim() ? bulkTopic.trim() : q.topic
        };
        await upsertQuestionOverride(patch);
      }
      setNotice(`Atualizadas ${selectedIds.length} questões.`);
    } catch (err){
      console.error(err);
      setNotice("Falha ao aplicar alterações em lote.");
    } finally {
      setSaving(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      for (const id of selectedIds){
        if (customIds.has(id)){
          await deleteQuestionCustom(id);
        } else {
          await upsertQuestionOverride({ id, deleted: true });
        }
      }
      setNotice(`Excluídas ${selectedIds.length} questões.`);
      clearSelection();
    } catch (err){
      console.error(err);
      setNotice("Falha ao excluir em lote.");
    } finally {
      setSaving(false);
    }
  };

  const bulkRestore = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      for (const id of selectedIds){
        if (customIds.has(id)) continue;
        await deleteQuestionOverride(id);
      }
      setNotice(`Revertidas ${selectedIds.length} questões (quando havia override).`);
    } catch (err){
      console.error(err);
      setNotice("Falha ao reverter em lote.");
    } finally {
      setSaving(false);
    }
  };

  const [edit, setEdit] = useState<null | {
    id: string;
    discipline: Discipline;
    subject: string;
    topic: string;
    difficulty: 1|2|3|4|5;
    type: QType;
    style: ExamStyle | undefined;
    statement: string;
    options: Record<"A"|"B"|"C"|"D"|"E", string>;
    correctKey: "A"|"B"|"C"|"D"|"E";
    hasAnswer: boolean;
  }>(null);

  useEffect(() => {
    if (!selected){
      setEdit(null);
      return;
    }
    const options: Record<"A"|"B"|"C"|"D"|"E", string> = { A: "", B: "", C: "", D: "", E: "" };
    selected.options.forEach(o => { options[o.key] = o.text; });
    setEdit({
      id: selected.id,
      discipline: selected.discipline,
      subject: selected.subject,
      topic: selected.topic,
      difficulty: selected.difficulty,
      type: selected.type,
      style: selected.style,
      statement: selected.statement,
      options,
      correctKey: selected.correctKey,
      hasAnswer: selected.hasAnswer !== false
    });
  }, [selected?.id, overridesVersion]);

  const save = async () => {
    if (!edit) return;
    setNotice(null);
    const opts = (Object.entries(edit.options) as Array<["A"|"B"|"C"|"D"|"E", string]>)
      .map(([key, text]) => ({ key, text: (text ?? "").trim() }))
      .filter(o => o.text);
    if (opts.length < 2){
      setNotice("A questão precisa de pelo menos 2 alternativas.");
      return;
    }
    const patch: QuestionPatch = {
      id: edit.id,
      discipline: edit.discipline,
      subject: edit.subject.trim() || edit.discipline,
      topic: edit.topic.trim() || edit.subject.trim() || edit.discipline,
      difficulty: edit.difficulty,
      type: edit.type,
      style: edit.style,
      statement: edit.statement.trim(),
      options: opts,
      correctKey: edit.correctKey,
      hasAnswer: edit.hasAnswer
    };
    setSaving(true);
    try {
      await upsertQuestionOverride(patch);
      setNotice("Questão atualizada para todos os usuários.");
    } catch (err: any){
      console.error("[admin] save failed", err?.message ?? err);
      setNotice("Falha ao salvar. Verifique sua conexão e permissões.");
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!edit) return;
    setNotice(null);
    setSaving(true);
    try {
      await deleteQuestionOverride(edit.id);
      setNotice("Override removido. Questão voltou ao original.");
    } catch (err: any){
      console.error("[admin] delete failed", err?.message ?? err);
      setNotice("Falha ao remover override.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin){
    return (
      <div style={{ padding: 16 }}>
        <div className="h2">Admin de Questões</div>
        <div className="sub">Apenas o administrador pode editar questões.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="h2">Admin de Questões</div>
      <div className="sub">Edite enunciado, alternativas e disciplina. Isso sincroniza com todos os dispositivos.</div>

      <div className="sep" />

      <div className="grid" style={{ gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
        <div style={{ gridColumn: "span 4" }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="sub">Buscar</div>
            <input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por texto" />
            <div className="sub" style={{ marginTop: 8 }}>Disciplina</div>
            <select className="input" value={discipline} onChange={(e)=>setDiscipline(e.target.value as any)}>
              <option value="Todas">Todas</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="pill" style={{ marginTop: 8, color:"var(--ink-500)" }}>{filtered.length} resultados</div>
          </div>

          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>Edição em lote</div>
            <div className="sub">Selecionadas: {selectedIds.length}</div>
            <div className="sub" style={{ marginTop: 8 }}>Disciplina</div>
            <select className="input" value={bulkDiscipline} onChange={(e)=>setBulkDiscipline(e.target.value as any)}>
              <option value="">(manter)</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="sub" style={{ marginTop: 8 }}>Assunto</div>
            <input className="input" value={bulkSubject} onChange={(e)=>setBulkSubject(e.target.value)} placeholder="(manter)" />
            <div className="sub" style={{ marginTop: 8 }}>Tópico</div>
            <input className="input" value={bulkTopic} onChange={(e)=>setBulkTopic(e.target.value)} placeholder="(manter)" />
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="btn btnPrimary" onClick={applyBulkUpdate} disabled={saving || selectedIds.length === 0}>
                Aplicar em lote
              </button>
              <button className="btn" onClick={bulkRestore} disabled={saving || selectedIds.length === 0}>
                Reverter alterações
              </button>
              <button className="btn" onClick={bulkDelete} disabled={saving || selectedIds.length === 0}>
                Excluir selecionadas
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>Importar JSON</div>
            <div className="sub">Aceita array de quest?es no formato do app.</div>
            <input
              className="input"
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const raw = await file.text();
                  const parsed = JSON.parse(raw);
                  if (!Array.isArray(parsed)){
                    setNotice("JSON inv?lido: esperado array.");
                    return;
                  }
                  setSaving(true);
                  let imported = 0;
                  for (let i=0;i<parsed.length;i++){
                    const item = parsed[i] ?? {};
                    const baseId = String(item.id ?? `custom-${Date.now()}-${i}`);
                    const discipline = (item.discipline ?? "Portugu?s") as Discipline;
                    const optionsRaw = item.options ?? item.choices ?? [];
                    const options = Array.isArray(optionsRaw)
                      ? optionsRaw.map((o: any) => ({ key: String(o.key ?? o.letter ?? "").toUpperCase(), text: String(o.text ?? o.value ?? "") }))
                      : Object.entries(optionsRaw).map(([k, v]) => ({ key: String(k).toUpperCase(), text: String(v) }));
                    const cleaned = options.filter(o => o.text).map(o => ({ key: o.key, text: o.text }));
                    const question: Question = {
                      id: baseId,
                      discipline,
                      subject: String(item.subject ?? discipline),
                      topic: String(item.topic ?? item.subject ?? discipline),
                      difficulty: Number(item.difficulty ?? 3) as any,
                      type: (item.type ?? (cleaned.length <= 2 ? "TF" : "MCQ")) as any,
                      style: item.style,
                      statement: String(item.statement ?? item.enunciado ?? "").trim(),
                      options: cleaned as any,
                      correctKey: (item.correctKey ?? "A") as any,
                      hasAnswer: item.hasAnswer ?? true,
                      explanation: item.explanation ?? { summary: "", whyCorrect: "", whyWrong: {}, tips: [] }
                    };
                    if (!question.statement || question.options.length < 2) continue;
                    await upsertQuestionCustom(question);
                    imported += 1;
                  }
                  setNotice(`Importadas ${imported} quest?es.`);
                } catch (err){
                  console.error(err);
                  setNotice("Falha ao importar JSON.");
                } finally {
                  setSaving(false);
                  e.currentTarget.value = "";
                }
              }}
            />
          </div>
          <div className="card" style={{ padding: 12, marginTop: 12, maxHeight: 520, overflowY: "auto" }}>
            {filtered.map(q => (
              <div key={q.id} className="row" style={{ alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  aria-label="Selecionar questão"
                />
                <button
                  className="btn"
                  style={{ flex: 1, textAlign: "left", background: q.id === selectedId ? "rgba(24,210,163,.18)" : "rgba(255,255,255,.06)" }}
                  onClick={() => setSelectedId(q.id)}
                >
                  <div style={{ fontWeight: 800 }}>{q.discipline}</div>
                  <div className="sub" style={{ marginTop: 4 }}>{q.statement.slice(0, 120)}</div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: "span 8" }}>
          {!edit && (
            <div className="card" style={{ padding: 12 }}>
              <div className="sub">Selecione uma questão para editar.</div>
            </div>
          )}
          {edit && (
            <div className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900 }}>Editando: {edit.id}</div>
                {getOverride(edit.id) && <span className="pill">Override ativo</span>}
              </div>
              <div className="sep" />

              <div className="grid" style={{ gridTemplateColumns: "repeat(12, 1fr)", gap: 10 }}>
                <div style={{ gridColumn: "span 4" }}>
                  <div className="sub">Disciplina</div>
                  <select className="input" value={edit.discipline} onChange={(e)=>setEdit({ ...edit, discipline: e.target.value as Discipline })}>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "span 4" }}>
                  <div className="sub">Assunto</div>
                  <input className="input" value={edit.subject} onChange={(e)=>setEdit({ ...edit, subject: e.target.value })} />
                </div>
                <div style={{ gridColumn: "span 4" }}>
                  <div className="sub">Tópico</div>
                  <input className="input" value={edit.topic} onChange={(e)=>setEdit({ ...edit, topic: e.target.value })} />
                </div>

                <div style={{ gridColumn: "span 6" }}>
                  <div className="sub">Enunciado</div>
                  <textarea className="input" style={{ minHeight: 120 }} value={edit.statement} onChange={(e)=>setEdit({ ...edit, statement: e.target.value })} />
                </div>
                <div style={{ gridColumn: "span 6" }}>
                  <div className="sub">Configurações</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <select className="input" value={edit.type} onChange={(e)=>setEdit({ ...edit, type: e.target.value as QType })}>
                      <option value="MCQ">MCQ</option>
                      <option value="TF">TF</option>
                    </select>
                    <select className="input" value={String(edit.difficulty)} onChange={(e)=>setEdit({ ...edit, difficulty: Number(e.target.value) as any })}>
                      {[1,2,3,4,5].map(d => <option key={d} value={d}>D{d}</option>)}
                    </select>
                    <select className="input" value={edit.style ?? "Nenhum"} onChange={(e)=>setEdit({ ...edit, style: e.target.value === "Nenhum" ? undefined : (e.target.value as ExamStyle) })}>
                      {styles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <label className="pill" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={edit.hasAnswer}
                        onChange={(e)=>setEdit({ ...edit, hasAnswer: e.target.checked })}
                        style={{ marginRight: 6 }}
                      />
                      Possui gabarito
                    </label>
                    <select
                      className="input"
                      value={edit.correctKey}
                      disabled={!edit.hasAnswer}
                      onChange={(e)=>setEdit({ ...edit, correctKey: e.target.value as any })}
                    >
                      {["A","B","C","D","E"].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ gridColumn: "span 12" }}>
                  <div className="sub">Alternativas</div>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {(["A","B","C","D","E"] as const).map((k) => (
                      <div key={k}>
                        <div className="sub">{k}</div>
                        <input
                          className="input"
                          value={edit.options[k]}
                          onChange={(e)=>setEdit({ ...edit, options: { ...edit.options, [k]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {notice && <div className="pill" style={{ marginTop: 10, color: "var(--warn-500)" }}>{notice}</div>}

              <div className="row" style={{ marginTop: 12, justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={async () => {
                    if (!edit) return;
                    setSaving(true);
                    try {
                      if (customIds.has(edit.id)){
                        await deleteQuestionCustom(edit.id);
                      } else {
                        await upsertQuestionOverride({ id: edit.id, deleted: true });
                      }
                      setNotice("Quest?o exclu?da para todos.");
                    } catch (err){
                      console.error(err);
                      setNotice("Falha ao excluir.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  Excluir quest?o
                </button>
                {getOverride(edit.id) && (
                  <button className="btn" onClick={restore} disabled={saving}>Restaurar original</button>
                )}
                <button className="btn btnPrimary" onClick={save} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar para todos"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
