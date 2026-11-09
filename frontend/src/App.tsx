import { Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './shell/Layout'
import { DevPanel } from './shell/DevPanel'
import { ActionLink, EmptyState } from './ui/ui'
import { PageHeader } from './ui/page'
import { useShell } from './state/shell'
import BerandaPage from './features/beranda/BerandaPage'
import TryoutList from './features/tryout/TryoutList'
import TryoutDetail from './features/tryout/TryoutDetail'
import Runner from './features/tryout/Runner'
import SubmitConfirm from './features/tryout/SubmitConfirm'
import TryoutResult from './features/tryout/TryoutResult'
import LatihanPick from './features/latihan/LatihanPick'
import PracticeSummary from './features/latihan/PracticeSummary'
import ProgresPage from './features/progres/ProgresPage'
import CompetencyDetail from './features/progres/CompetencyDetail'
import LainnyaPage from './features/lainnya/LainnyaPage'
import QuestionList from './features/lainnya/QuestionList'
import QuestionDetail from './features/lainnya/QuestionDetail'
import { GenerationProgress, GenerationSetup } from './features/lainnya/Generation'
import AiSettings from './features/lainnya/AiSettings'
import { ConfigDetail, ConfigList } from './features/lainnya/ConfigPages'
import ReviewSoal from './features/lainnya/ReviewSoal'
import { MaterialDetail, MaterialList } from './features/lainnya/Materi'
import { PackageDetail, PackageList } from './features/lainnya/Paket'
import Pengaturan from './features/lainnya/Pengaturan'
import Notifikasi from './features/lainnya/Notifikasi'

/**
 * The learner routes and every Kelola screen of FRONTEND_PAGE_SPECIFICATIONS §10–§19, plus one
 * not-found route. FRONTEND_ROUTING lists fewer; the page spec's inventory is the fuller one.
 * The developer panel is mounted once, outside the router, so it never appears inside a route's page.
 */
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout><BerandaPage /></Layout>} />
        <Route path="/tryout" element={<Layout><TryoutList /></Layout>} />
        <Route path="/tryout/:packageId" element={<Layout><TryoutDetail /></Layout>} />
        <Route path="/tryout/sesi/:sessionId" element={<Layout hideDock><Runner mode="tryout" /></Layout>} />
        <Route path="/tryout/sesi/:sessionId/konfirmasi" element={<Layout hideDock><SubmitConfirm /></Layout>} />
        <Route path="/tryout/sesi/:sessionId/hasil" element={<Layout><TryoutResult mode="tryout" /></Layout>} />
        <Route path="/latihan" element={<Layout><LatihanPick /></Layout>} />
        <Route path="/latihan/sesi/:sessionId" element={<Layout hideDock><Runner mode="practice" /></Layout>} />
        <Route path="/latihan/sesi/:sessionId/hasil" element={<Layout><PracticeSummary /></Layout>} />
        <Route path="/progres" element={<Layout><ProgresPage /></Layout>} />
        <Route path="/progres/kompetensi/:id" element={<Layout><CompetencyDetail /></Layout>} />
        <Route path="/lainnya" element={<Layout><LainnyaPage /></Layout>} />
        <Route path="/lainnya/soal" element={<Layout><QuestionList /></Layout>} />
        <Route path="/lainnya/soal/:id" element={<Layout><QuestionDetail /></Layout>} />
        <Route path="/lainnya/generasi" element={<Layout><GenerationSetup /></Layout>} />
        <Route path="/lainnya/generasi/:jobId" element={<Layout><GenerationProgress /></Layout>} />
        <Route path="/lainnya/ai" element={<Layout><AiSettings /></Layout>} />
        <Route path="/lainnya/ujian" element={<Layout><ConfigList /></Layout>} />
        <Route path="/lainnya/ujian/:id" element={<Layout><ConfigDetail /></Layout>} />
        <Route path="/lainnya/review" element={<Layout><ReviewSoal /></Layout>} />
        <Route path="/lainnya/materi" element={<Layout><MaterialList /></Layout>} />
        <Route path="/lainnya/materi/:id" element={<Layout><MaterialDetail /></Layout>} />
        <Route path="/lainnya/paket" element={<Layout><PackageList /></Layout>} />
        <Route path="/lainnya/paket/:id" element={<Layout><PackageDetail /></Layout>} />
        <Route path="/lainnya/pengaturan" element={<Layout><Pengaturan /></Layout>} />
        <Route path="/lainnya/notifikasi" element={<Layout><Notifikasi /></Layout>} />
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
      <DevPanel />
    </>
  )
}

/** The one route that matched nothing: a way back, not a dead end. */
function NotFound() {
  const navigate = useNavigate()
  const { leaveSession } = useShell()
  useEffect(() => {
    leaveSession()
  }, [leaveSession])
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-page flex-col justify-center">
      <PageHeader eyebrow="404" title="Halaman tidak ditemukan" lead="Alamat ini tidak ada di aplikasi." />
      <EmptyState
        title="Tidak ada yang bisa dibuka di sini"
        className="mt-6"
        action={
          <>
            <ActionLink to="/">Kembali ke Beranda</ActionLink>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-[14px] border border-border-strong bg-surface px-5 text-md font-semibold text-ink hover:bg-surface-muted"
            >
              Halaman sebelumnya
            </button>
          </>
        }
      >
        Periksa alamat di bilah browser, atau mulai lagi dari Beranda. Tidak ada data yang hilang.
      </EmptyState>
    </div>
  )
}
