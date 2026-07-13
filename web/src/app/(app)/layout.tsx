import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentProfile } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <AppSidebar role={profile?.role ?? null} />
        <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
          <AppHeader profile={profile} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
