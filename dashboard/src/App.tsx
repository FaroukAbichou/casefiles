import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/layout/dashboard-layout";
import BlogPage from "@/pages/blog-page";
import CaseStudiesPage from "@/pages/case-studies-page";
import SiteSectionPage from "@/pages/site-section-page";

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/case-studies/projects" replace />} />
        <Route
          path="/case-studies"
          element={<Navigate to="/case-studies/projects" replace />}
        />
        <Route path="/case-studies/projects" element={<CaseStudiesPage />} />
        <Route path="/blog/articles" element={<BlogPage />} />
        <Route path="/blog" element={<Navigate to="/blog/articles" replace />} />
        <Route path="/site/:section" element={<SiteSectionPage />} />
        <Route path="/site" element={<Navigate to="/site/testimonials" replace />} />
        <Route path="*" element={<Navigate to="/case-studies/projects" replace />} />
      </Route>
    </Routes>
  );
}
