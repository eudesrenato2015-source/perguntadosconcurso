import os
import re
import json
from typing import Dict, List, Tuple
from PyPDF2 import PdfReader
from unicodedata import normalize as uni_normalize

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PDF_DIR = os.path.join(ROOT, "para quest\u00f5es")
OUT_PATH = os.path.join(ROOT, "src", "data", "packs", "importedFromPdfs.ts")

DISCIPLINES = [
    "Portugu\u00eas",
    "Constitucional",
    "Administrativo",
    "Penal/Proc Penal",
    "DH/Criminologia",
    "Inform\u00e1tica/RLM",
    "Seguran\u00e7a Org\u00e2nica",
    "Hist\u00f3ria",
]

def read_pdf_text(path: str) -> str:
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)
    return "\n".join(parts)

def normalize(text: str) -> str:
    text = text.replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"^pcimarkpci.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^www\.pciconcursos\.com\.br.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+P\u00e1gina\s+\d+.*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text

def fix_mojibake(text: str) -> str:
    if "\u00c3" in text or "\u00c2" in text:
        try:
            return text.encode("latin1").decode("utf-8")
        except Exception:
            return text
    return text

def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in uni_normalize("NFKD", text) if not re.match(r"[\u0300-\u036f]", ch)
    )

def slugify(text: str) -> str:
    text = strip_accents(text.lower())
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")

def extract_gabaritos(reader: PdfReader) -> Dict[str, Dict[int, str]]:
    gabaritos: Dict[str, Dict[int, str]] = {}
    for page in reader.pages:
        text = page.extract_text() or ""
        if "Gabarito agrupado" not in text:
            continue
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        try:
            idx = lines.index("Gabarito agrupado")
        except ValueError:
            continue
        label = " ".join(lines[:idx]).strip()
        key: Dict[int, str] = {}
        for num, letter in re.findall(r"\b(\d{1,3})-?([A-E])\b", text):
            n = int(num)
            if 1 <= n <= 300:
                key[n] = letter
        if label and key:
            gabaritos[label] = key
    return gabaritos

def extract_answer_key_from_text(text: str) -> Dict[int, str]:
    key: Dict[int, str] = {}
    m = re.search(r"(GABARITO|Gabarito)(.*)$", text, re.IGNORECASE | re.DOTALL)
    if not m:
        return key
    tail = m.group(2)
    for num, letter in re.findall(r"\b(\d{1,3})\s*[-\)\.]?\s*([A-E])\b", tail):
        n = int(num)
        if 1 <= n <= 300:
            key[n] = letter
    return key

def resolve_exam_label(text: str, labels: Dict[str, str]) -> str | None:
    t = strip_accents(text.lower())
    if "tecnico do mpu" in t or "ministerio publico" in t:
        return labels.get("mpu")
    if "senado federal" in t or "tecnico legislativo" in t:
        return labels.get("senado")
    if "trf1" in t or "policia judicial" in t:
        return labels.get("trf1")
    if "aleto" in t or "policial legislativo ii" in t:
        return labels.get("aleto")
    if "transpetro" in t:
        return labels.get("transpetro")
    return None

def split_questions(text: str) -> List[Tuple[int, str]]:
    lines = [line.strip() for line in text.split("\n")]
    indices = [i for i, line in enumerate(lines) if re.match(r"^\d{1,3}$", line)]
    out = []
    for idx, start in enumerate(indices):
        end = indices[idx + 1] if idx + 1 < len(indices) else len(lines)
        num = int(lines[start])
        body_lines = [ln for ln in lines[start + 1:end] if ln]
        if not body_lines:
            continue
        out.append((num, "\n".join(body_lines)))
    return out

def split_questions_flexible(text: str) -> List[Tuple[int, str]]:
    lines = [line.strip() for line in text.split("\n")]
    indices = [i for i, line in enumerate(lines) if re.match(r"^\d{1,3}[\)\.]?\s", line)]
    out = []
    for idx, start in enumerate(indices):
        end = indices[idx + 1] if idx + 1 < len(indices) else len(lines)
        num_match = re.match(r"^(\d{1,3})", lines[start])
        if not num_match:
            continue
        num = int(num_match.group(1))
        body_lines = [ln for ln in lines[start:end] if ln]
        if not body_lines:
            continue
        out.append((num, "\n".join(body_lines)))
    return out

def parse_options(body: str) -> Tuple[str, List[Tuple[str, str]]]:
    lines = [line.strip() for line in body.split("\n") if line.strip()]
    opt_indices = []
    for idx, line in enumerate(lines):
        if re.match(r"^\(?[A-Ea-e]\)?[\)\.\-]?\s+", line):
            opt_indices.append(idx)
    if not opt_indices:
        return "", []
    statement = " ".join(lines[:opt_indices[0]]).strip()
    options = []
    for i, idx in enumerate(opt_indices):
        end = opt_indices[i + 1] if i + 1 < len(opt_indices) else len(lines)
        block = " ".join(lines[idx:end]).strip()
        m = re.match(r"^\(?([A-Ea-e])\)?[\)\.\-]?\s+(.*)$", block)
        if not m:
            continue
        key = m.group(1).upper()
        text = m.group(2).strip()
        options.append((key, text))
    if len(options) > 5:
        options = options[:5]
    return statement, options

def infer_discipline(text: str) -> str:
    t = strip_accents(text.lower())
    if any(k in t for k in ["constitui", "art.", "emenda", "direitos fundamentais"]):
        return "Constitucional"
    if any(k in t for k in ["administra", "licitacao", "servidor", "ato administrativo"]):
        return "Administrativo"
    if any(k in t for k in ["codigo penal", "pena", "crime", "processo penal", "inquerito"]):
        return "Penal/Proc Penal"
    if any(k in t for k in ["direitos humanos", "criminolog", "violencia", "cidadania"]):
        return "DH/Criminologia"
    if any(k in t for k in ["informatica", "internet", "sistema", "rede", "seguranca da informacao", "logica"]):
        return "Inform\u00e1tica/RLM"
    if any(k in t for k in ["seguranca organica", "vigilancia", "ronda", "perimetro", "controle de acesso"]):
        return "Seguran\u00e7a Org\u00e2nica"
    if any(k in t for k in ["historia", "republica", "goias", "goiania", "era vargas"]):
        return "Hist\u00f3ria"
    if any(k in t for k in ["portugues", "gramatica", "ortografia", "crase", "regencia", "concordancia"]):
        return "Portugu\u00eas"
    return "Administrativo"

def subject_topic_for(discipline: str) -> Tuple[str, str]:
    if discipline == "Portugu\u00eas":
        return "L\u00edngua Portuguesa", "Interpreta\u00e7\u00e3o/Gram\u00e1tica"
    if discipline == "Constitucional":
        return "Direito Constitucional", "Princ\u00edpios e direitos"
    if discipline == "Administrativo":
        return "Direito Administrativo", "Atos e Administra\u00e7\u00e3o"
    if discipline == "Penal/Proc Penal":
        return "Direito Penal/Processual Penal", "Teoria do crime"
    if discipline == "DH/Criminologia":
        return "Direitos Humanos/Criminologia", "Direitos e pol\u00edticas p\u00fablicas"
    if discipline == "Inform\u00e1tica/RLM":
        return "Inform\u00e1tica/RLM", "Fundamentos"
    if discipline == "Seguran\u00e7a Org\u00e2nica":
        return "Seguran\u00e7a Org\u00e2nica", "Procedimentos e controle"
    if discipline == "Hist\u00f3ria":
        return "Hist\u00f3ria", "Hist\u00f3ria do Brasil/Goi\u00e1s"
    return "Conhecimentos Gerais", "Conte\u00fado geral"

def difficulty_for(text: str) -> int:
    length = len(text)
    if length < 220:
        return 2
    if length < 360:
        return 3
    if length < 520:
        return 4
    return 5

def build_questions():
    if not os.path.isdir(PDF_DIR):
        raise SystemExit("Pasta 'para quest\u00f5es' n\u00e3o encontrada.")

    questions = []
    seen_statements = set()

    for filename in os.listdir(PDF_DIR):
        if not filename.lower().endswith(".pdf"):
            continue
        path = os.path.join(PDF_DIR, filename)
        reader = PdfReader(path)
        gabaritos = extract_gabaritos(reader)
        label_map = {
            "mpu": "MPU 2025 - T\u00e9cnico do MPU - Pol\u00edcia Institucional - Tipo 1",
            "senado": "Senado 2022 - T\u00e9cnico Legislativo - Policial Legislativo - Tipo 1",
            "trf1": "TRF1 2024 - T\u00e9cnico Judici\u00e1rio (Agente da Pol\u00edcia Judicial) - Tipo 3 (Amarela)",
            "aleto": "ALETO 2024 - Policial Legislativo II - Pol\u00edcia e Seguran\u00e7a II - Tipo 1",
            "transpetro": "Transpetro 2023.1 - N\u00edvel M\u00e9dio - Prova 13 (Seguran\u00e7a)",
        }
        normalized_gabaritos: Dict[str, Dict[int, str]] = {}
        for label, key in gabaritos.items():
            normalized_gabaritos[strip_accents(label.lower())] = key

        base = slugify(os.path.splitext(filename)[0])
        current_label: str | None = None

        for page in reader.pages:
            text = normalize(page.extract_text() or "")
            text = fix_mojibake(text)
            text = re.sub(r"\(([A-E])\)", r"\n\1)", text)
            text = re.sub(r"([A-E])\)\s*", r"\n\1) ", text)
            detected = resolve_exam_label(text, label_map)
            if detected:
                current_label = detected
            if not current_label:
                continue
            key = normalized_gabaritos.get(strip_accents(current_label.lower()), {})
            for num, body in split_questions(text):
                statement, options = parse_options(body)
                statement = fix_mojibake(statement)
                options = [(k, fix_mojibake(v)) for k, v in options]
                statement = re.sub(r"\(\s*$", "", statement).strip()
                options = [(k, re.sub(r"^\(", "", v).strip()) for k, v in options]
                options = [(k, re.sub(r"\)\s*$", "", v).strip()) for k, v in options]
                if not statement or len(options) < 4:
                    continue
                if len(statement) < 30 or len(statement) > 450:
                    continue
                if any(len(v) > 240 for _, v in options):
                    continue
                if statement in seen_statements:
                    continue
                opt_texts = [opt[1] for opt in options]
                if len(set(opt_texts)) != len(opt_texts):
                    continue
                correct = key.get(num)
                if correct is None:
                    continue
                if correct not in dict(options):
                    continue
                seen_statements.add(statement)
                discipline = infer_discipline(statement)
                subject, topic = subject_topic_for(discipline)
                qid = f"pdf-{base}-{strip_accents(current_label.lower()).replace(' ', '_')}-{num}"
                questions.append(make_question(qid, statement, options, correct, discipline, subject, topic))

        text = normalize(read_pdf_text(path))
        text = fix_mojibake(text)
        text = re.sub(r"\(([A-E])\)", r"\n\1)", text)
        text = re.sub(r"([A-E])\)\s*", r"\n\1) ", text)
        if not normalized_gabaritos:
            fallback_key = extract_answer_key_from_text(text)
            if fallback_key:
                blocks = split_questions_flexible(text)
                for num, body in blocks:
                    statement, options = parse_options(body)
                    statement = fix_mojibake(statement)
                    options = [(k, fix_mojibake(v)) for k, v in options]
                    statement = re.sub(r"\(\s*$", "", statement).strip()
                    options = [(k, re.sub(r"^\(", "", v).strip()) for k, v in options]
                    options = [(k, re.sub(r"\)\s*$", "", v).strip()) for k, v in options]
                    if not statement or len(options) < 4:
                        continue
                    if len(statement) < 30 or len(statement) > 450:
                        continue
                    if any(len(v) > 240 for _, v in options):
                        continue
                    if statement in seen_statements:
                        continue
                    opt_texts = [opt[1] for opt in options]
                    if len(set(opt_texts)) != len(opt_texts):
                        continue
                    correct = fallback_key.get(num)
                    if correct is None:
                        continue
                    if correct not in dict(options):
                        continue
                    seen_statements.add(statement)
                    discipline = infer_discipline(statement)
                    subject, topic = subject_topic_for(discipline)
                    qid = f"pdf-{base}-{num}"
                    questions.append(make_question(qid, statement, options, correct, discipline, subject, topic))

            # Inline gabarito por questão (ex.: "Gabarito: E")
            for num, body in split_questions_flexible(text):
                core = re.split(r"(Coment\\w*|Gabarito)", body, flags=re.IGNORECASE)[0]
                statement, options = parse_options(core)
                statement = fix_mojibake(statement)
                options = [(k, fix_mojibake(v)) for k, v in options]
                statement = re.sub(r"\(\s*$", "", statement).strip()
                options = [(k, re.sub(r"^\(", "", v).strip()) for k, v in options]
                options = [(k, re.sub(r"\)\s*$", "", v).strip()) for k, v in options]
                if not statement or len(options) < 4:
                    continue
                if len(statement) < 30 or len(statement) > 450:
                    continue
                if any(len(v) > 240 for _, v in options):
                    continue
                if statement in seen_statements:
                    continue
                opt_texts = [opt[1] for opt in options]
                if len(set(opt_texts)) != len(opt_texts):
                    continue
                m_ans = re.search(r"Gabarito\\s*:?\\s*([A-E])", body, re.IGNORECASE)
                if not m_ans:
                    continue
                correct = m_ans.group(1).upper()
                if correct not in dict(options):
                    continue
                seen_statements.add(statement)
                discipline = infer_discipline(statement)
                subject, topic = subject_topic_for(discipline)
                qid = f"pdf-{base}-{num}"
                questions.append(make_question(qid, statement, options, correct, discipline, subject, topic))

        inline = []
        if "historia" in filename.lower() or "geografia" in filename.lower():
            inline = extract_inline_questions(text)
        for num, statement, options, correct in inline:
            statement = fix_mojibake(statement)
            options = [(k, fix_mojibake(v)) for k, v in options]
            if not statement or len(options) < 4:
                continue
            if statement in seen_statements:
                continue
            opt_texts = [opt[1] for opt in options]
            if len(set(opt_texts)) != 5:
                continue
            if correct not in dict(options):
                continue
            seen_statements.add(statement)
            discipline = infer_discipline(statement)
            subject, topic = subject_topic_for(discipline)
            qid = f"pdf-{base}-inline-{num}"
            questions.append(make_question(qid, statement, options, correct, discipline, subject, topic))

    return questions

def extract_inline_questions(text: str) -> List[Tuple[int, str, List[Tuple[str, str]], str]]:
    out = []
    pattern = re.compile(
        r"(\d{1,3})\.\s*[^\n]*\n(.*?)\nA\)\s*(.*?)\nB\)\s*(.*?)\nC\)\s*(.*?)\nD\)\s*(.*?)\nE\)\s*(.*?)\n.*?RESPOSTA:\s*[\"\u201c\u201d']?([A-E])",
        re.IGNORECASE | re.DOTALL
    )
    for m in pattern.finditer(text):
        num = int(m.group(1))
        statement = " ".join(m.group(2).split())
        if "?" in statement:
            statement = statement.rsplit("?", 1)[0].strip() + "?"
        statement = statement.replace("EXERC\u00cdCIOS COMPLEMENTARES", "").strip()
        if len(statement) < 30 or len(statement) > 400:
            continue
        options = [
            ("A", " ".join(m.group(3).split())),
            ("B", " ".join(m.group(4).split())),
            ("C", " ".join(m.group(5).split())),
            ("D", " ".join(m.group(6).split())),
            ("E", " ".join(m.group(7).split())),
        ]
        if any(len(v) > 220 for _, v in options):
            continue
        correct = m.group(8).upper()
        out.append((num, statement, options, correct))
    return out

def make_question(qid: str, statement: str, options: List[Tuple[str, str]], correct: str, discipline: str, subject: str, topic: str):
    return {
        "id": qid,
        "discipline": discipline,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty_for(statement),
        "type": "MCQ",
        "style": "FGV",
        "statement": statement,
        "options": [{"key": k, "text": v} for k, v in options],
        "correctKey": correct,
        "explanation": {
            "summary": "Gabarito identificado no material.",
            "whyCorrect": "Alternativa correta conforme gabarito.",
            "whyWrong": { k: "Distrator conforme padr\u00e3o de banca." for k, _ in options if k != correct },
            "tips": ["Leia todas as alternativas antes de responder."]
        }
    }

def main():
    questions = build_questions()
    pack = {
        "id": "pack-imported-pdfs",
        "name": "Quest\u00f5es importadas (PDFs)",
        "discipline": "Misto",
        "questions": questions
    }
    content = (
        "import type { QuestionPack } from \"../../types\";\n\n"
        "export const importedPdfPack: QuestionPack = "
        + json.dumps(pack, ensure_ascii=False, indent=2)
        + ";\n"
    )
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Geradas {len(questions)} quest\u00f5es em {OUT_PATH}")

if __name__ == "__main__":
    main()
