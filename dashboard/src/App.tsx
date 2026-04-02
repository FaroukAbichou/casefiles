import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/layout/dashboard-layout";
import BlogPage from "@/pages/blog-page";
import CaseStudiesPage from "@/pages/case-studies-page";
import CloudinaryBrowserPage from "@/pages/cloudinary-browser-page";
import LayoutHelperPage from "@/pages/layout-helper-page";
import SettingsPage from "@/pages/settings-page";
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
        <Route path="/cloudinary" element={<Navigate to="/cloudinary/browser" replace />} />
        <Route path="/cloudinary/browser" element={<CloudinaryBrowserPage />} />
        <Route path="/tools/layout" element={<LayoutHelperPage />} />
        <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
        <Route path="/settings/general" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/case-studies/projects" replace />} />
      </Route>
    </Routes>
  );
}
