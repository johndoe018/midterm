"""Extract the supplied question bank without generating or rewriting its answers."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = subprocess.check_output(["pdftotext", "-layout", str(ROOT / "public/question-bank.pdf"), "-"], text=True)
lines = []
for line in raw.replace("\f", "\n").splitlines():
    text = line.strip()
    if "AI & MULTIMEDIA TECHNOLOGIES IN EDUCATION • MIDTERM PRACTICE" in text:
        continue
    if "Source-grounded study bank | Page" in text:
        continue
    lines.append(text)
text = "\n".join(lines)
sections = [
    ("AI и промптинг", "Weeks 1–2: AI in Mathematics Education and Prompt Engineering", "Основы AI, проверка ответов и точные промпты", "spark"),
    ("Планирование уроков", "AI for Lesson Planning", "От учебной цели до готового плана занятия", "layout"),
    ("Математические задачи", "Week 4: AI for Mathematics Problems", "Создание задач, решения и типичные ошибки", "function"),
    ("Объяснение математики", "AI for Mathematical Explanations", "Понятные объяснения и педагогический контекст", "message"),
    ("Визуализация", "Mathematical Visualization", "Графики, модели и интерактивные представления", "chart"),
    ("Дифференциация", "AI for Differentiated Learning", "Общая цель и разные пути к пониманию", "layers"),
    ("Исследования и ошибки AI", "Attached Research Readings and Documented AI Errors", "Дополнительные статьи и разбор реальных ошибок", "book"),
]
events = list(re.finditer(r"^(?:(?P<section>[1-7])\. (?P<title>[^\n]+)\nSource: (?P<source>[^\n]+)|(?P<id>Q\d{3}|E\d{2})\. )", text, re.M))
questions = []
topic = None
source = None
join = lambda s: re.sub(r"\s+", " ", s).strip()
for i, event in enumerate(events):
    if event.group("section"):
        topic = int(event.group("section"))
        source = event.group("source")
        assert event.group("title") == sections[topic - 1][1]
        continue
    block = text[event.end():events[i + 1].start() if i + 1 < len(events) else len(text)]
    block = block.split("PART II —")[0].split("Final examination reminder")[0]
    q = {"id": event.group("id"), "topic": topic, "source": source}
    if q["id"].startswith("Q"):
        match = re.fullmatch(r"(.*?)\nA\. (.*?)\nB\. (.*?)\nC\. (.*?)\nD\. (.*?)\nAnswer: ([ABCD]) — (.*?)\nReference: (.*?)\s*", block, re.S)
        assert match, (q["id"], block)
        q.update(type="mcq", question=join(match[1]), options=[join(match[n]) for n in range(2, 6)], answer="ABCD".index(match[6]), explanation=join(match[7]), reference=join(match[8]))
    else:
        match = re.fullmatch(r"(.*?)\nReference: (.*?)\n\s*Model answer: (.*?)\nMarking guide \(5 marks\): (.*?)\s*", block, re.S)
        assert match, (q["id"], block)
        rubric = [re.sub(r"^\d\.\s*", "", part.strip()) for part in join(match[4]).split("|")]
        assert len(rubric) == 5, q["id"]
        q.update(type="essay", question=join(match[1]), reference=join(match[2]), modelAnswer=join(match[3]), rubric=rubric)
    questions.append(q)

assert [q["id"] for q in questions if q["type"] == "mcq"] == [f"Q{i:03}" for i in range(1, 257)]
assert [q["id"] for q in questions if q["type"] == "essay"] == [f"E{i:02}" for i in range(1, 74)]
assert [(sum(q["topic"] == i and q["type"] == "mcq" for q in questions), sum(q["topic"] == i and q["type"] == "essay" for q in questions)) for i in range(1, 8)] == [(48,12),(38,11),(33,10),(26,9),(35,10),(35,10),(41,11)]
bank = {"title": "AI Midterm Complete Practice Question Bank", "topics": [{"id": i, "title": s[0], "originalTitle": s[1], "description": s[2], "icon": s[3], "supplementary": i == 7} for i, s in enumerate(sections, 1)], "questions": questions}
(ROOT / "public/bank.json").write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n")
print(f"Extracted and validated {len(questions)} questions: 256 MCQs, 73 essays, 7 topics.")
