import { Link } from 'react-router-dom'
import { Panel } from '../../ui/ui'
import { PageHeader } from '../../ui/page'
import { IconArrowUpRight, IconBook, IconExam, IconLayers, IconPlug, IconSearch, IconSparkle } from '../../ui/icons'

/**
 * Lainnya (`/lainnya`) — PAGE_SPECIFICATIONS §10. The Kelola group plus Tentang; no account section,
 * because the app has none. Items without a route are omitted rather than shown disabled.
 */
const ITEMS = [
  {
    to: '/lainnya/soal',
    title: 'Kumpulan soal',
    body: 'Tinjau status, cek validasi, dan ubah siklus hidup soal.',
    icon: IconBook,
    meta: 'Soal & tinjauan',
  },
  {
    to: '/lainnya/generasi',
    title: 'Buat soal dengan AI',
    body: 'Minta soal baru untuk satu kompetensi.',
    icon: IconSparkle,
    meta: 'Pembuatan soal',
  },
  {
    to: '/lainnya/materi',
    title: 'Materi',
    body: 'Bahan bacaan dengan sumber, disetujui per versi.',
    icon: IconBook,
    meta: 'Bacaan & sumber',
  },
  {
    to: '/lainnya/review',
    title: 'Review soal',
    body: 'Batch yang menunggu sampel dan soal yang dilaporkan.',
    icon: IconSearch,
    meta: 'Tinjauan & laporan',
  },
  {
    to: '/lainnya/paket',
    title: 'Paket',
    body: 'Susunan soal tryout dan latihan, beserta versinya.',
    icon: IconLayers,
    meta: 'Susunan soal',
  },
  {
    to: '/lainnya/ai',
    title: 'Pengaturan AI',
    body: 'Penyedia model, model per tugas, dan uji koneksi.',
    icon: IconPlug,
    meta: 'Koneksi AI',
  },
  {
    to: '/lainnya/ujian',
    title: 'Konfigurasi ujian',
    body: 'Aturan yang diikuti tryout, beserta persetujuannya.',
    icon: IconExam,
    meta: 'Aturan & persetujuan',
  },
]

export default function LainnyaPage() {
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Lainnya"
        title="Kelola dan pengaturan"
        lead="Semua pengaturan bisa diubah dari perangkat ini. Aplikasi ini tidak memakai akun."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <section aria-labelledby="kelola">
          <h2 id="kelola" className="mb-3 text-xl">
            Kelola
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {ITEMS.map(({ to, title, body, icon: ItemIcon, meta }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex h-full flex-col rounded-[24px] border border-border bg-surface p-5 shadow-panel transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-lavender text-lavender-ink">
                      <ItemIcon size={21} />
                    </span>
                    <IconArrowUpRight
                      size={18}
                      className="mt-1 text-muted transition-colors group-hover:text-primary-ink"
                    />
                  </div>
                  <h3 className="mt-3.5 font-display text-lg">{title}</h3>
                  <p className="mt-1 flex-1 text-base leading-relaxed text-muted">{body}</p>
                  <p className="mt-3 text-sm font-medium text-muted">{meta}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Panel tone="muted" className="p-6">
          <h2 className="text-xl">Tentang</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">
            TryoutSim menyiapkan latihan SKD CPNS untuk dipakai sendiri di perangkat ini. Susunan soal dan
            penilaian mengikuti aturan yang dapat dipertanggungjawabkan; angka ambang batas hanya ditampilkan bila
            aturan yang dipakai menyebutkannya. Hasil di sini adalah latihan, bukan jaminan kelulusan seleksi.
          </p>
          <dl className="mt-5 space-y-2.5 border-t border-border-strong/60 pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Jalur</dt>
              <dd className="font-medium">CPNS</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Akun</dt>
              <dd className="font-medium">Tidak diperlukan</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Data</dt>
              <dd className="font-medium">Tersimpan di perangkat ini</dd>
            </div>
          </dl>
          <div className="mt-5 space-y-2.5 border-t border-border-strong/60 pt-4 text-sm">
            <Link to="/lainnya/notifikasi" className="flex items-center justify-between gap-3 font-semibold text-primary-ink hover:underline">
              Pusat pemberitahuan
              <IconArrowUpRight size={16} />
            </Link>
            <Link to="/lainnya/pengaturan" className="flex items-center justify-between gap-3 font-semibold text-primary-ink hover:underline">
              Pengaturan backup
              <IconArrowUpRight size={16} />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
