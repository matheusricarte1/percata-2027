import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

export const metadata: Metadata = {
  title: "PERCATA | UPE Campus Petrolina & Ouricuri",
  description:
    "Sistema de Gestão de Demandas para o Plano de Contratações Anual (PCA) — UPE, em conformidade com a Lei 14.133/2021.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
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
