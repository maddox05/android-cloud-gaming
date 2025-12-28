import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./home/Home";
import Pricing from "./pricing/Pricing";
import Queue from "./queue/Queue";
import InGame from "./in_game/InGame";

function AppLayout() {
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith("/app/") || location.pathname.startsWith("/queue/");

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/queue/:appId" element={<Queue />} />
        <Route path="/app/:appId" element={<InGame />} />
      </Routes>
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
