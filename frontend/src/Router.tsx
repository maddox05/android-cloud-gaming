import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthModalProvider } from "./context/AuthModalContext";
import { UserProvider } from "./context/UserContext";
import { AuthModal } from "./components/AuthModal";
import { AlertPopup } from "./components/AlertPopup";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const Home = lazy(() => import("./home/Home"));
const Pricing = lazy(() => import("./pricing/Pricing"));
const Roadmap = lazy(() => import("./roadmap/Roadmap"));
const Queue = lazy(() => import("./queue/Queue"));
const InGame = lazy(() => import("./in_game/InGame"));
const About = lazy(() => import("./pages/About"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CopyrightPolicy = lazy(() => import("./pages/CopyrightPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const JoinWaitlist = lazy(() => import("./launch/JoinWaitlist"));
const Waitlist = lazy(() => import("./launch/Waitlist"));
const RedeemInvite = lazy(() => import("./launch/RedeemInvite"));

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
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/copyright-policy" element={<CopyrightPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/queue/:appId" element={<Queue />} />
          <Route path="/app/:appId" element={<InGame />} />
          <Route path="/waitlist" element={<JoinWaitlist />} />
          <Route path="/waitlist/:userId" element={<Waitlist />} />
          <Route path="/redeem" element={<RedeemInvite />} />
          <Route path="/redeem/:inviteCode" element={<RedeemInvite />} />
        </Routes>
      </Suspense>
      {!hideNavFooter && <Footer />}
      <AuthModal />
      <AlertPopup />
    </>
  );
}

export default function Router() {
  return (
    <UserProvider>
      <AuthModalProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </AuthModalProvider>
    </UserProvider>
  );
}
