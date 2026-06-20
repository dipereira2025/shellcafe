import "./globals.css";

export const metadata = {
  title: "Shell Café Ponto V2",
  description: "Sistema seguro de ponto para Shell Café"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
