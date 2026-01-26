import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyProvider } from "@/components/CompanyContext";
import { UserProfileProvider } from "@/components/UserProfileContext";
import { FavoritesProvider } from "@/components/FavoritesManager";
import { OnboardingChecklistProvider } from "@/components/OnboardingChecklist";

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <UserProfileProvider>
      <CompanyProvider>
        <FavoritesProvider>
          <OnboardingChecklistProvider>
            <AppLayout>{children}</AppLayout>
          </OnboardingChecklistProvider>
        </FavoritesProvider>
      </CompanyProvider>
    </UserProfileProvider>
  );
}
