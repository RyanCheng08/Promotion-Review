const fs = require("fs");
const path = require("path");

const sources = [
  {
    file: "C:/Users/admin/Documents/晋升问题.txt",
    group: "高频核心题",
  },
  {
    file: "C:/Users/admin/Documents/晋升问题2.txt",
    group: "追问扩展题",
  },
];

function parseQuestions(text, group) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result = [];
  let section = group;
  let current = null;

  const flush = () => {
    if (!current) return;
    current.answer = current.answer.join("\n").trim();
    if (current.question && current.answer) result.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current) current.answer.push("");
      continue;
    }

    if (/^[一二三四五六七八九十]+、/.test(line)) {
      flush();
      section = line.replace(/[?？]+$/, "");
      continue;
    }

    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
      flush();
      current = {
        id: `${group}-${match[1]}`,
        source: group,
        section,
        number: Number(match[1]),
        question: match[2].trim(),
        answer: [],
      };
      continue;
    }

    if (current) current.answer.push(line);
  }

  flush();
  return result;
}

const cards = sources.flatMap((source) => {
  const text = fs.readFileSync(source.file, "utf8");
  return parseQuestions(text, source.group);
});

const output = `window.PROMOTION_QA = ${JSON.stringify(cards, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, "qa-data.js"), output, "utf8");

console.log(`Generated ${cards.length} review cards.`);
