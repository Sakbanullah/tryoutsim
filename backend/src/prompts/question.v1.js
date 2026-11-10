/**
 * `question.twk_2026` template, version `1` (PROMPT_SPECIFICATION §3).
 *
 * Structure and invariant text are copied from the canonical doc; the
 * `{{goal}}` slot is filled from the taxonomy row, never hard-coded (§1 rule 3).
 * Wording changes are a new version file, never an edit (§1 rule 1).
 */

export const QUESTION_PROMPT = Object.freeze({ id: 'question.twk_2026', version: '1' });

/** The user-message body template. Slots: `{{count}}` `{{test}}` `{{label}}` `{{goal}}` `{{difficulty}}`. */
const USER_TEMPLATE = `Buat {{count}} soal pilihan ganda untuk kompetensi:
  test: {{test}}
  kompetensi: {{label}}
  tujuan resmi kompetensi (untuk dasar, bukan untuk dicantumkan): {{goal}}
  tingkat kesulitan: {{difficulty}}

Setiap soal:
- 5 opsi bertanda A, B, C, D, E.
- Untuk TKP (Tes Karakteristik Pribadi): skenario perilaku; setiap opsi diberi bobot 1–5
  (5 = paling tepat), tanpa opsi bernilai 0. Sertakan juga "optionJustifications": untuk SETIAP
  huruf opsi, satu kalimat mengapa opsi itu memperoleh bobot tersebut.
- Untuk TWK/TIU: tepat satu jawaban benar; tanpa "optionJustifications".
- Kunci jawaban disertakan sebagai struktur optionScores (lihat skema).
- TIDAK menuliskan "Soal Resmi", "Soal CPNS/BKN", atau logo resmi.

Output JSON sesuai skema:
{ "questions": [ { "stem": ..., "options": [{"key":"A","text":...}, ...],
  "answerKey": { "optionScores": {...}, "optionJustifications": {"A": "...", ...},
                 "unansweredScore": 0, "maxScore": 5 },
  "explanation": ... } ] }

Jika mode JSON tidak tersedia, keluarkan JSON di dalam fence \`\`\`json\`\`\`.`;

/**
 * Build the messages for one batch.
 *
 * @param {{count: number, test: string, label: string, goal: string, difficulty: string}} values
 * @returns {{role: 'system'|'user', content: string}[]}
 */
export function buildQuestionMessages({ count, test, label, goal, difficulty }) {
  for (const [name, value] of Object.entries({ test, label, goal, difficulty })) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Prompt slot ${name} is empty.`);
  }
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Prompt slot count must be a positive integer.');
  /** @type {Record<string, string>} */
  const slots = { count: String(count), test, label, goal, difficulty };
  const user = USER_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in slots)) throw new Error(`No value for prompt slot ${name}.`);
    return /** @type {Record<string, string>} */ (slots)[name];
  });
  return [
    {
      role: 'system',
      content: 'Anda menyusun soal latihan. Bahasa Indonesia. Format JSON saja.\nKonteks: ini soal LATIHAN AI, bukan soal resmi CPNS/BKN.',
    },
    { role: 'user', content: user },
  ];
}
