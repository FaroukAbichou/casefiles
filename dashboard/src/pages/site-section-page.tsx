import { Navigate, useOutletContext, useParams } from "react-router-dom";
import SiteContentPanel, { type SiteSection } from "@/SiteContentPanel";
import type { DashboardOutletContext } from "@/dashboard-context";

const VALID: SiteSection[] = ["testimonials", "experience", "education"];

function isSiteSection(s: string | undefined): s is SiteSection {
  return s !== undefined && (VALID as string[]).includes(s);
}

export default function SiteSectionPage() {
  const { showToast } = useOutletContext<DashboardOutletContext>();
  const { section } = useParams<{ section: string }>();

  if (!isSiteSection(section)) {
    return <Navigate to="/site/testimonials" replace />;
  }

  return (
    <SiteContentPanel key={section} showToast={showToast} section={section} />
  );
}
