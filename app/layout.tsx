import "./globals.css";

export const metadata = {
  title: "BarManager — Gestion multi-clients",
  description: "Plateforme de gestion de bars en libre-service",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
