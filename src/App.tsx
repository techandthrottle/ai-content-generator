import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BrollGenerator from './pages/BrollGenerator';
import TextToAudio from './pages/TextToAudio';
import LipsyncGenerator from './pages/LipsyncGenerator';
import ImageToVideo from './pages/ImageToVideo';
import DetailView from './pages/DetailView';

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isStandalone = new URLSearchParams(location.search).get('standalone') === 'true';

  if (isStandalone) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto py-6">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout>
            <div className="flex items-center justify-center min-h-[60vh]">
              <h1 className="text-4xl font-bold text-center">Welcome to Media Generation Platform</h1>
            </div>
          </Layout>
        } />
        <Route path="/broll" element={
          <Layout>
            <BrollGenerator />
          </Layout>
        } />
        <Route path="/text-to-audio" element={
          <Layout>
            <TextToAudio />
          </Layout>
        } />
        <Route path="/lipsync" element={
          <Layout>
            <LipsyncGenerator />
          </Layout>
        } />
        <Route path="/image-to-video" element={
          <Layout>
            <ImageToVideo />
          </Layout>
        } />
        <Route path="/detail/:type/:id" element={
          <Layout>
            <DetailView />
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App