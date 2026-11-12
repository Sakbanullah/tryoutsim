/**
 * Seed the `competency` table from COMPETENCY_TAXONOMY.md §3–§6.
 *
 * A re-runnable operator step for a local E2E run, not a product feature: the taxonomy ships as data
 * (COMPETENCY_TAXONOMY §8), and this file is that data transcribed from the canonical doc. Idempotent —
 * an existing node is left untouched, so a newer taxonomy edit is applied by editing this file and
 * re-running. Connects as the migration role (`DATABASE_URL`), the role that may write taxonomy.
 *
 *   node scripts/seed-taxonomy.mjs
 */

import pg from 'pg';

const TIER = 'EVIDENCE-BACKED-NOT-CPNS-2026';

/** The taxonomy, verbatim from COMPETENCY_TAXONOMY §3–§6: `[id, label, goal]`, parents listed first. */
const NODES = [
  // §3 TWK — five domains, no sub-domains.
  ['TWK.NASIONALISME', 'Nasionalisme', 'Mampu mewujudkan kepentingan nasional melalui cita-cita dan tujuan yang sama dengan tetap mempertahankan identitas nasional'],
  ['TWK.INTEGRITAS', 'Integritas', 'Mampu menjunjung tinggi kejujuran, ketangguhan, komitmen dan konsistensi sebagai satu kesatuan sikap untuk mencapai tujuan nasional'],
  ['TWK.BELA_NEGARA', 'Bela negara', 'Mampu berperan aktif dalam mempertahankan eksistensi bangsa dan negara'],
  ['TWK.PILAR_NEGARA', 'Pilar negara', 'Mampu membentuk karakter positif melalui pemahaman dan pengamalan nilai-nilai dalam Pancasila, UUD 1945, NKRI dan Bhinneka Tunggal Ika'],
  ['TWK.BAHASA_NEGARA', 'Bahasa negara', 'Mampu menggunakan bahasa Indonesia sebagai bahasa persatuan yang sangat penting kedudukannya dalam kehidupan bermasyarakat, berbangsa, dan bernegara'],

  // §4 TIU — three domains, each with the sub-domains the doc lists; a leaf gets the domain's own goal,
  // because §6 gives no per-leaf wording for TIU beyond the leaf label.
  ['TIU.VERBAL', 'Verbal', 'Bernalar melalui bahasa'],
  ['TIU.VERBAL.ANALOGI', 'Analogi', 'Bernalar melalui perbandingan dua konsep kata yang memiliki hubungan tertentu, lalu menggunakan konsep hubungan tersebut pada situasi lain'],
  ['TIU.VERBAL.SILOGISME', 'Silogisme', 'Menarik kesimpulan dari dua pernyataan yang diberikan'],
  ['TIU.VERBAL.ANALITIS', 'Analitis', 'Menganalisis informasi yang diberikan dan menarik kesimpulan'],
  ['TIU.NUMERIK', 'Numerik', 'Bernalar melalui angka dan kuantitas'],
  ['TIU.NUMERIK.BERHITUNG', 'Berhitung', 'Kemampuan hitung sederhana'],
  ['TIU.NUMERIK.DERET', 'Deret angka', 'Melihat pola hubungan angka'],
  ['TIU.NUMERIK.PERBANDINGAN_KUANTITATIF', 'Perbandingan kuantitatif', 'Menarik kesimpulan berdasarkan dua data kuantitatif'],
  ['TIU.NUMERIK.SOAL_CERITA', 'Soal cerita', 'Analisis kuantitatif dari informasi yang diberikan'],
  ['TIU.FIGURAL', 'Figural', 'Bernalar melalui gambar'],
  ['TIU.FIGURAL.ANALOGI', 'Figural — analogi', 'Bernalar melalui perbandingan dua gambar yang memiliki hubungan tertentu, lalu menggunakan konsep hubungan tersebut pada situasi lain'],
  ['TIU.FIGURAL.KETIDAKSAMAAN', 'Figural — ketidaksamaan', 'Melihat perbedaan beberapa gambar'],
  ['TIU.FIGURAL.SERIAL', 'Figural — serial', 'Melihat pola hubungan dalam bentuk gambar'],

  // §5 TKP — six domains, no sub-domains.
  ['TKP.PELAYANAN_PUBLIK', 'Pelayanan publik', 'Menampilkan perilaku keramahtamahan dalam bekerja yang efektif agar bisa memenuhi kebutuhan dan kepuasan orang lain sesuai dengan tugas dan wewenang yang dimiliki'],
  ['TKP.JEJARING_KERJA', 'Jejaring kerja', 'Membangun dan membina hubungan, bekerja sama, berbagi informasi dan berkolaborasi dengan orang lain secara efektif'],
  ['TKP.SOSIAL_BUDAYA', 'Sosial budaya', 'Beradaptasi dan bekerja secara efektif dalam masyarakat majemuk'],
  ['TKP.TIK', 'Teknologi informasi dan komunikasi', 'Memanfaatkan teknologi informasi secara efektif untuk meningkatkan kinerja'],
  ['TKP.PROFESIONALISME', 'Profesionalisme', 'Melaksanakan tugas dan fungsi sesuai dengan tuntutan jabatan'],
  ['TKP.ANTI_RADIKALISME', 'Anti radikalisme', 'Menjaring informasi dari individu tentang pengetahuan terhadap anti radikalisme, kecenderungan bersikap, dan bertindak saat menanggapi stimulus dengan beberapa alternatif situasi'],
];

/** The parent id of a node: the id with its last segment removed, or `null` for a top-level node. */
function parentOf(id) {
  const parts = id.split('.');
  return parts.length > 2 ? parts.slice(0, -1).join('.') : null;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set. Load .env first (backend/db/README.md).');

const client = new pg.Client({ connectionString });
await client.connect();
let inserted = 0;
try {
  await client.query('BEGIN');
  for (const [id, label, goal] of NODES) {
    const test = id.split('.')[0];
    const result = await client.query(
      `INSERT INTO competency (id, "parentId", test, label, goal, tier)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, parentOf(id), test, label, goal, TIER],
    );
    inserted += result.rowCount;
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
console.log(`competency: ${inserted} inserted, ${NODES.length - inserted} already present`);
