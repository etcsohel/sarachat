import type { ReactNode } from "react";
import AppHeader from "@/components/dashboard/AppHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute"; // To ensure user is authenticated

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
