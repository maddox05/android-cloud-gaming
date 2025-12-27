import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./home/Home";
import Pricing from "./pricing/Pricing";
import InGame from "./in_game/InGame";

function AppLayout() {
  const location = useLocation();
  const isInGame = location.pathname.startsWith("/app/");

  return (
    <>
      {!isInGame && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
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
