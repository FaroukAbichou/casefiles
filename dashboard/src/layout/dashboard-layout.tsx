import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getHealth } from "@/api";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { DashboardOutletContext } from "@/dashboard-context";

const titles: Record<string, string> = {
  "/case-studies/projects": "Case studies",
  "/blog/articles": "Blog",
  "/site/testimonials": "Site · Testimonials",
  "/site/experience": "Site · Experience",
  "/site/education": "Site · Education",
  "/cloudinary/browser": "Cloudinary · Browser",
  "/tools/layout": "Tools · Layout helper",
  "/settings/general": "Settings · General",
};

export function DashboardLayout() {
  const [toast, setToast] = useState<string | null>(null);
  const [contentRoot, setContentRoot] = useState<string | null>(null);
  const { pathname } = useLocation();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const context = useMemo<DashboardOutletContext>(
    () => ({ showToast }),
    [showToast]
  );

  useEffect(() => {
    getHealth()
      .then((h) => setContentRoot(h.contentRoot))
      .catch(() => setContentRoot(null));
  }, []);

  const title = titles[pathname] ?? "Dashboard";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {title}
            </h1>
            {contentRoot ? (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {contentRoot}
              </p>
            ) : null}
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
          <Outlet context={context} />
        </main>
      </SidebarInset>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-md"
        >
          {toast}
        </div>
      ) : null}
    </SidebarProvider>
  );
}
