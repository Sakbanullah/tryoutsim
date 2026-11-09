import type { AnswerKey, Question, Test } from '../types/contracts'

/**
 * `MOCK DATA — NOT FROM API`
 * Hand-written practice items. Stems claim no official origin: every AI-origin item renders
 * "Latihan AI — bukan soal resmi". No regulation, count, duration or threshold is implied by them
 * (FRONTEND_MOCK_DATA_STRATEGY §3). Keys follow the SCORING_METHODOLOGY §2.2 shape: TWK/TIU score
 * `maxScore` for the keyed option and 0 otherwise; TKP carries weights 1–5 with no keyed option.
 */

const KEYS = ['A', 'B', 'C', 'D', 'E'] as const

type Spec = {
  id: string
  test: Test
  competencyId: string
  difficulty: 'easy' | 'medium' | 'hard'
  stem: string
  options: [string, string, string, string, string]
  /** TWK/TIU: index of the keyed option. TKP: the five weights, in option order. */
  key: number | [number, number, number, number, number]
  explanation: string
  /** TKP only — one reason per option, keyed exactly like `answerKey.optionScores` (V-13). */
  justifications?: [string, string, string, string, string]
  provenance: 'ai_generated' | 'ai_generated_human_reviewed' | 'human_authored'
  sourceRefs?: string[]
}

const SPECS: Spec[] = [
  {
    id: 'q-twk-01',
    test: 'TWK',
    competencyId: 'TWK.NASIONALISME',
    difficulty: 'easy',
    stem: 'Lagu Indonesia Raya dikumandangkan pertama kali pada peristiwa apa?',
    options: [
      'Sumpah Pemuda 28 Oktober 1928',
      'Proklamasi Kemerdekaan 17 Agustus 1945',
      'Kongres Pemuda Pertama 1926',
      'Upacara peringatan hari nasional pertama 1950',
      'Peresmian Konstitusi 18 Agustus 1945',
    ],
    key: 0,
    explanation:
      'Indonesia Raya dikumandangkan pertama kali saat penutupan Kongres Pemuda Kedua, 28 Oktober 1928, peristiwa yang juga menghasilkan Sumpah Pemuda.',
    provenance: 'ai_generated_human_reviewed',
    sourceRefs: ['Materi kebangsaan: Kongres Pemuda Kedua (1928)'],
  },
  {
    id: 'q-twk-02',
    test: 'TWK',
    competencyId: 'TWK.INTEGRITAS',
    difficulty: 'medium',
    stem: 'Seorang pegawai menemukan data hasil ujian yang dapat mengubah skornya. Sikap yang paling mencerminkan integritas adalah …',
    options: [
      'Mengubah data karena tidak ada yang melihat',
      'Melaporkan temuan ke atasan dan membiarkan data apa adanya',
      'Menyimpan salinan data untuk diperiksa sendiri nanti',
      'Meminta rekan memberi akses lebih luas',
      'Mengabaikan data dan tidak melapor',
    ],
    key: 1,
    explanation:
      'Integritas berarti menjunjung kejujuran dan konsistensi. Menemukan data merupakan kesempatan untuk melaporkannya secara jujur, bukan mengubahnya, sehingga yang pertama dan benar adalah melapor dan tidak mengubah apa pun.',
    provenance: 'ai_generated_human_reviewed',
    sourceRefs: ['Materi kebangsaan: Integritas'],
  },
  {
    id: 'q-twk-03',
    test: 'TWK',
    competencyId: 'TWK.BELA_NEGARA',
    difficulty: 'easy',
    stem: 'Bentuk bela negara yang paling sesuai bagi pelajar adalah …',
    options: [
      'Ikut pertahanan sipil di wilayah konflik',
      'Menguasai ilmu pengetahuan dan menjaga persatuan di sekolah',
      'Menghindari kegiatan sosial agar fokus belajar',
      'Menolak semua kegiatan ekstrakurikuler',
      'Menunggu panggilan resmi sebelum berkontribusi',
    ],
    key: 1,
    explanation:
      'Bela negara bagi pelajar berbentuk kontribusi sesuai kapasitas, antara lain belajar sungguh-sungguh dan menjaga persatuan, bukan memaksakan peran militer.',
    provenance: 'ai_generated_human_reviewed',
    sourceRefs: ['Materi kebangsaan: Bela negara'],
  },
  {
    id: 'q-twk-04',
    test: 'TWK',
    competencyId: 'TWK.PILAR_NEGARA',
    difficulty: 'medium',
    stem: 'Fungsi utama UUD 1945 dalam kehidupan negara adalah …',
    options: [
      'Menjadi sumber hukum tertinggi yang mengatur penyelenggaraan negara',
      'Menjadi pedoman upacara kenegaraan',
      'Mengatur organisasi partai politik',
      'Menetapkan anggaran tahunan negara',
      'Menggantikan peraturan daerah',
    ],
    key: 0,
    explanation:
      'UUD 1945 adalah bentuk hukum dasar tertinggi. Peraturan di bawah selalu bertitik tolak dari UUD dan tidak boleh bertentangan dengannya.',
    provenance: 'ai_generated_human_reviewed',
    sourceRefs: ['Materi kebangsaan: Pilar negara'],
  },
  {
    id: 'q-twk-05',
    test: 'TWK',
    competencyId: 'TWK.BAHASA_NEGARA',
    difficulty: 'medium',
    stem: 'Kedudukan bahasa Indonesia sebagai bahasa negara tercantum dalam …',
    options: [
      'Sumpah Pemuda 1928',
      'UUD 1945 Pasal 36',
      'Pidato kenegaraan pertama 1945',
      'Deklarasi pendidikan nasional',
      'Peraturan menteri tentang kurikulum',
    ],
    key: 1,
    explanation:
      'UUD 1945 Pasal 36 menyatakan bahwa bahasa negara ialah bahasa Indonesia. Sumpah Pemuda 1928 menyebut bahasa persatuan, yang merupakan awal perjalanan, bukan penetapan kedudukan sebagai bahasa negara.',
    provenance: 'ai_generated_human_reviewed',
    sourceRefs: ['Materi kebangsaan: Bahasa negara'],
  },
  {
    id: 'q-tiu-01',
    test: 'TIU',
    competencyId: 'TIU.VERBAL.ANALOGI',
    difficulty: 'easy',
    stem: 'Buku : halaman = rumah : …',
    options: ['Atap', 'Kamar', 'Keluarga', 'Taman', 'Pagar'],
    key: 1,
    explanation:
      'Buku terdiri atas halaman, sebagaimana rumah terdiri atas kamar; hubungannya bagian yang menyusun keseluruhan.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tiu-02',
    test: 'TIU',
    competencyId: 'TIU.VERBAL.SILOGISME',
    difficulty: 'medium',
    stem: 'Semua peserta tryout membawa kartu ujian. Beberapa peserta memakai seragam biru. Kesimpulan yang pasti benar adalah …',
    options: [
      'Semua pemakai seragam biru membawa kartu ujian',
      'Beberapa pemakai seragam biru membawa kartu ujian',
      'Tidak ada pemakai seragam biru yang membawa kartu ujian',
      'Semua pembawa kartu ujian memakai seragam biru',
      'Peserta yang tidak memakai biru tidak membawa kartu',
    ],
    key: 1,
    explanation:
      'Pemakai seragam biru adalah peserta, dan setiap peserta membawa kartu ujian, sehingga pasti ada (beberapa) pemakai seragam biru yang membawa kartu ujian.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tiu-03',
    test: 'TIU',
    competencyId: 'TIU.NUMERIK.BERHITUNG',
    difficulty: 'easy',
    stem: 'Hasil dari 12 × 15 − 40 : 8 adalah …',
    options: ['170', '175', '180', '185', '190'],
    key: 1,
    explanation: 'Kerjakan perkalian dan pembagian lebih dulu: 180 − 5 = 175.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tiu-04',
    test: 'TIU',
    competencyId: 'TIU.NUMERIK.DERET',
    difficulty: 'medium',
    stem: 'Lanjutan deret 3, 6, 11, 18, 27, … adalah …',
    options: ['34', '36', '38', '40', '42'],
    key: 2,
    explanation:
      'Selisih antarsuku bertambah dua setiap langkah: 3, 5, 7, 9, maka selisih berikutnya 11 dan suku berikutnya 27 + 11 = 38.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tiu-05',
    test: 'TIU',
    competencyId: 'TIU.NUMERIK.SOAL_CERITA',
    difficulty: 'medium',
    stem: 'Harga 3 buku dan 2 pena adalah Rp 43.000. Jika satu pena Rp 5.000, harga satu buku adalah …',
    options: ['Rp 9.000', 'Rp 10.000', 'Rp 11.000', 'Rp 12.000', 'Rp 13.000'],
    key: 2,
    explanation: 'Dua pena Rp 10.000, sehingga tiga buku bernilai Rp 33.000 dan satu buku Rp 11.000.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-ai-01',
    test: 'TIU',
    competencyId: 'TIU.VERBAL.ANALITIS',
    difficulty: 'hard',
    stem: 'Draf soal untuk latihan: Rina membaca 30 halaman dalam 45 menit. Berapa halaman yang ia baca dalam 1 jam 15 menit dengan kecepatan tetap?',
    options: ['40', '45', '48', '50', '55'],
    key: 3,
    explanation: 'Kecepatan 30 halaman per 45 menit sama dengan 40 per jam, sehingga 1 jam 15 menit menghasilkan 50 halaman.',
    provenance: 'ai_generated',
  },
  {
    id: 'q-tiu-06',
    test: 'TIU',
    competencyId: 'TIU.VERBAL.ANALITIS',
    difficulty: 'hard',
    stem: 'Berdasarkan teks, bila peserta fokus pada analisis data lebih dari 60% sesi latihan, kenaikan skor rata-rata mencapai 8%, sedangkan pola serupa tidak ditemukan pada latihan hafalan. Pernyataan yang paling didukung adalah …',
    options: [
      'Hafalan selalu menurunkan skor',
      'Analisis data yang tinggi berkaitan dengan kenaikan skor pada sampel ini',
      'Semua peserta wajib fokus analisis data',
      'Latihan hafalan tidak pernah berguna',
      'Analisis data menjamin lulus',
    ],
    key: 1,
    explanation:
      'Teks hanya menunjukkan kaitan pada sampel. Tidak ada dasar untuk pernyataan mutlak seperti "selalu" atau "menjamin".',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-01',
    test: 'TKP',
    competencyId: 'TKP.PELAYANAN_PUBLIK',
    difficulty: 'medium',
    stem: 'Seorang warga datang meminta informasi layanan ketika kamu sedang menyelesaikan laporan mendesak. Sikap yang paling mencerminkan pelayanan publik adalah …',
    options: [
      'Meminta warga kembali keesokan harinya',
      'Menyelesaikan laporan lebih dahulu tanpa memberi tahu warga',
      'Mengarahkan warga ke petugas lain tanpa penjelasan',
      'Menyambut warga, memberi jawaban singkat, lalu melanjutkan laporan',
      'Menjelaskan bahwa pelayanan ditutup sementara',
    ],
    key: [5, 3, 2, 5, 2],
    justifications: [
      'Menutup layanan pada warga yang sudah datang tidak mencerminkan pelayanan publik.',
      'Mengabaikan warga tanpa memberi tahu membuatnya menunggu tanpa kepastian.',
      'Mengalihkan tanpa penjelasan memindahkan masalah tanpa menyelesaikannya.',
      'Menyambut, menjawab ringkas, lalu melanjutkan laporan menghormati warga sekaligus menjaga pekerjaan utama.',
      'Menyatakan layanan tutup padahal warga sudah hadir menutup akses yang seharusnya terbuka.',
    ],
    explanation:
      'Pelayanan publik menempatkan kebutuhan orang di depan, tetapi juga menjaga pekerjaan utama: menyambut, menjawab dengan ringkas, lalu melanjutkan laporan memberi hasil terbaik pada dua sisi. Pilihan yang mengabaikan warga secara langsung paling tidak tepat.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-02',
    test: 'TKP',
    competencyId: 'TKP.JEJARING_KERJA',
    difficulty: 'easy',
    stem: 'Dalam kerja kelompok, satu rekan selalu menyelesaikan bagiannya terlambat. Sikap yang paling efektif membangun jejaring kerja adalah …',
    options: [
      'Mengerjakan bagiannya diam-diam agar selesai',
      'Mengadukan seluruh masalah kepada atasan',
      'Mengajak rekan bicara untuk memahami kendala dan menyepakati tenggat',
      'Menghindari rekan agar tidak terganggu',
      'Menyerahkan bagian rekan ke anggota lain',
    ],
    key: [1, 3, 5, 3, 2],
    justifications: [
      'Mengerjakan diam-diam menyelesaikan tugas tetapi tidak membuka jalur komunikasi dengan rekan.',
      'Mengadu ke atasan tanpa dialog menutup peluang perbaikan hubungan kerja.',
      'Mengajak bicara untuk memahami kendala dan menyepakati tenggat membuka komunikasi dan menjaga hubungan.',
      'Menghindari rekan tidak menyelesaikan akar masalah keterlambatan.',
      'Menyerahkan bagian rekan memindahkan tugas tanpa melibatkan pihak yang bersangkutan.',
    ],
    explanation:
      'Jejaring kerja tumbuh dari komunikasi terbuka: mendengar kendala dan menyepakati tenggat menyelesaikan masalah sekaligus menjaga hubungan. Mengambil alih atau melapor ke atasan tanpa dialog menutup peluang perbaikan.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-03',
    test: 'TKP',
    competencyId: 'TKP.SOSIAL_BUDAYA',
    difficulty: 'medium',
    stem: 'Tempat kerja barumu memiliki kebiasaan berbeda dari yang kamu kenal. Sikap yang paling mencerminkan adaptasi sosial budaya adalah …',
    options: [
      'Mempertahankan kebiasaan lamamu tanpa berdiskusi',
      'Mengamati, menanyakan dengan sopan, dan menyesuaikan diri',
      'Mengikuti semua kebiasaan tanpa bertanya apa pun',
      'Menghindari kegiatan bersama rekan baru',
      'Menyarankan kebiasaan lama sebagai satu-satunya cara',
    ],
    key: [1, 5, 2, 2, 2],
    explanation:
      'Beradaptasi berarti memahami kebiasaan baru melalui observasi dan bertanya dengan sopan, lalu menyesuaikan diri tanpa melepas nilai pribadi. Mengikuti tanpa bertanya kurang tepat; memaksakan kebiasaan lama paling tidak efektif.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-04',
    test: 'TKP',
    competencyId: 'TKP.PROFESIONALISME',
    difficulty: 'medium',
    stem: 'Kamu menerima tugas di luar kebiasaanmu dengan tenggat ketat. Sikap yang paling profesional adalah …',
    options: [
      'Menolak tugas tanpa menjelaskan alasan',
      'Menyanggupi lalu berharap masalah selesai sendiri',
      'Menyanggupi, memahami kebutuhannya, dan menetapkan prioritas kerja',
      'Meminta rekan mengerjakan sebagian besar tugas',
      'Menunda sampai tenggat terlihat jelas',
    ],
    key: [1, 1, 5, 3, 2],
    explanation:
      'Profesionalisme berarti memenuhi tugas dengan tuntutan jabatan: menerima tugas, memahami kebutuhannya, dan mengatur prioritas agar selesai tepat waktu.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-05',
    test: 'TKP',
    competencyId: 'TKP.TIK',
    difficulty: 'easy',
    stem: 'Sistem pencatatan berkas masih manual dan sering hilang. Sikap yang paling mencerminkan pemanfaatan teknologi informasi adalah …',
    options: [
      'Tetap memakai cara manual karena sudah terbiasa',
      'Mengusulkan pengarsipan digital sederhana, mengujinya, lalu mengajarkannya ke rekan',
      'Mengunduh aplikasi tanpa memeriksa kebutuhan',
      'Menunggu instruksi atasan sebelum bertindak',
      'Memindahkan semua berkas sendiri tanpa menjelaskan',
    ],
    key: [1, 5, 2, 2, 3],
    explanation:
      'TIK dimanfaatkan secara efektif ketika solusi sederhana diusulkan, diuji, dan dibagikan. Memilih aplikasi tanpa memeriksa kebutuhan atau bertindak sendiri tanpa penjelasan kurang tepat.',
    provenance: 'ai_generated_human_reviewed',
  },
  {
    id: 'q-tkp-06',
    test: 'TKP',
    competencyId: 'TKP.ANTI_RADIKALISME',
    difficulty: 'hard',
    stem: 'Di grup obrolan kerja, seseorang membagikan ajakan untuk memusuhi kelompok tertentu. Sikap yang paling tepat adalah …',
    options: [
      'Membalas dengan penjelasan panjang di grup',
      'Mendiamkan pesan agar tidak memperkeruh suasana',
      'Meneruskan pesan agar rekan tahu',
      'Menolak pesan dengan tenang, menasihati secara pribadi, dan melapor ke atasan',
      'Mengeluarkan orang tersebut dari grup tanpa penjelasan',
    ],
    key: [2, 1, 1, 5, 2],
    explanation:
      'Menolak ajakan memusuhi kelompok menjaga nilai kebangsaan. Menasihati secara pribadi menjaga hubungan tanpa memperluas provokasi, dan melapor ke atasan memastikan masalah ditangani dengan benar.',
    provenance: 'ai_generated_human_reviewed',
  },
]

const CONFIG_ID = 'skd-cpns-2026-provisional'

function keyFor(spec: Spec): AnswerKey {
  // Per-question maximum, from SCORING_METHODOLOGY §2.2's shape — the value per correct TWK/TIU key.
  const maxScore = 5
  const optionScores: Record<string, number> = {}
  KEYS.forEach((k, i) => {
    if (Array.isArray(spec.key)) optionScores[k] = spec.key[i]
    else optionScores[k] = i === spec.key ? maxScore : 0
  })
  // TKP reasons are part of the key (QUESTION_SPECIFICATION §1.2); TWK/TIU carry none.
  const optionJustifications =
    spec.justifications === undefined
      ? undefined
      : Object.fromEntries(KEYS.map((k, i) => [k, spec.justifications![i]]))
  return {
    questionId: spec.id,
    scoringVersion: 1,
    optionScores,
    unansweredScore: 0,
    maxScore,
    ...(optionJustifications ? { optionJustifications } : {}),
  }
}

function hashOf(stem: string, options: string[]): string {
  // Deterministic, non-cryptographic stand-in for contentHash display only; never used for dedup logic.
  let h = 0
  for (const ch of stem + options.join('')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `mock-${h.toString(16).padStart(8, '0')}`
}

const CREATED_AT = '2026-11-08T02:00:00.000Z'

export const QUESTIONS: Question[] = SPECS.map((spec) => {
  const options = spec.options.map((text, i) => ({ key: KEYS[i], text }))
  const hasValidation = spec.provenance !== 'human_authored'
  const reviewed = spec.provenance === 'ai_generated_human_reviewed'
  return {
    id: spec.id,
    configId: CONFIG_ID,
    test: spec.test,
    competencyId: spec.competencyId,
    difficulty: spec.difficulty,
    stem: spec.stem,
    options,
    answerKey: keyFor(spec),
    explanation: spec.explanation,
    sourceRefs: spec.sourceRefs,
    provenance:
      spec.provenance === 'human_authored'
        ? { kind: 'human_authored', authoredAt: CREATED_AT }
        : {
            kind: spec.provenance,
            providerId: 'local-mock',
            modelId: 'mock-model',
            promptTemplateId: 'mock-template',
            promptVersion: '1',
            generationId: `gen-${spec.id}`,
            generatedAt: CREATED_AT,
            // A plain AI draft has no human review yet; the reviewed variant carries it.
            reviewedBy: reviewed ? 'Pengguna lokal' : undefined,
            reviewedAt: reviewed ? CREATED_AT : undefined,
          },
    lifecycle: spec.id === 'q-ai-01' ? 'draft' : 'active',
    review: {
      reviewer: 'Pengguna lokal',
      reviewedAt: CREATED_AT,
      decision: 'accepted',
      answerKeyValidatedBy: 'Pengguna lokal',
      answerKeyValidatedAt: CREATED_AT,
    },
    validation: hasValidation
      ? {
          contentHash: hashOf(spec.stem, spec.options),
          result: 'pass',
          checks: [
            { id: 'V-01', passed: true },
            { id: 'V-02', passed: true },
            { id: 'V-03', passed: true },
            { id: 'V-04', passed: true },
            { id: 'V-05', passed: true },
            { id: 'V-06', passed: true },
            { id: 'V-07', passed: true },
            { id: 'V-08', passed: true },
            { id: 'V-09', passed: true },
            { id: 'V-10', passed: spec.test !== 'TKP' || spec.explanation.length > 80 },
            { id: 'V-11', passed: spec.test !== 'TWK' || Boolean(spec.sourceRefs?.length) },
            { id: 'V-12', passed: true },
          ],
          validatorVersion: 'mock-1',
          validatedAt: CREATED_AT,
        }
      : undefined,
    language: 'id',
    createdAt: CREATED_AT,
    contentVersion: 1,
    contentHash: hashOf(spec.stem, spec.options),
  }
})
