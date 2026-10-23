import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { requireAuth } from "@/lib/auth-utils";

const Layout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  await requireAuth();
  const billingEnabled = Boolean(
    process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_SUCCESS_URL,
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar billingEnabled={billingEnabled} />

        {/* Main content only */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
