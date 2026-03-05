import "./globals.css";

export const metadata = {
  title: "Aéro-Club Bar",
  description: "Bar en libre-service",
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
