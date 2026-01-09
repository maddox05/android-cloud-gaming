import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AuthModal } from "./components/AuthModal";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { trackPageView } from "./utils/metaPixel";

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
const JoinWaitlist = lazy(() => import("./waitlist/JoinWaitlist"));
const Waitlist = lazy(() => import("./waitlist/Waitlist"));
const RedeemInvite = lazy(() => import("./redeem/RedeemInvite"));

function AppLayout() {
  const location = useLocation();
  const hideNavFooter = location.pathname.startsWith("/app/") || location.pathname.startsWith("/queue/");

  // Track page views on route changes
  useEffect(() => {
    trackPageView();
  }, [location.pathname]);

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
    </>
  );
}

export default function Router() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
