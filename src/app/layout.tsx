import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const rootFontVariables = {
  "--font-inter": '"Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
  "--font-outfit": '"Segoe UI Semibold", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: "PERCATA | UPE Campus Petrolina & Ouricuri",
  description:
    "Sistema de Gestão de Demandas para o Plano de Contratações Anual (PCA) — UPE, em conformidade com a Lei 14.133/2021.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning style={rootFontVariables}>
      <body className="min-h-screen bg-background antialiased">
        <InitColorSchemeScript
          attribute="class"
          defaultMode="light"
          modeStorageKey="percata-mode"
          colorSchemeStorageKey="percata-color-scheme"
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
