import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const Home = lazy(() => import("./home/Home"));
const Pricing = lazy(() => import("./pricing/Pricing"));
const Queue = lazy(() => import("./queue/Queue"));
const InGame = lazy(() => import("./in_game/InGame"));

function AppLayout() {
  const location = useLocation();
  const hideNavFooter = location.pathname.startsWith("/app/") || location.pathname.startsWith("/queue/");

  return (
    <>
      {!hideNavFooter && <Navbar />}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/queue/:appId" element={<Queue />} />
          <Route path="/app/:appId" element={<InGame />} />
        </Routes>
      </Suspense>
      {!hideNavFooter && <Footer />}
    </>
  );
}

export default function Router() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
