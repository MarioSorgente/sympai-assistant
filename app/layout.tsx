export const metadata = {
  title: "SympAI – TSE Copilot",
  description: "Close the hardware knowledge gap for Technical Sales Engineers."
};

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
