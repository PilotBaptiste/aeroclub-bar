import "./globals.css";

export const metadata = {
  title: "Aéro-Club Bar",
  description: "Bar en libre-service — Paiement par carte ou espèces",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
