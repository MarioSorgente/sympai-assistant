import "./globals.css";

export const metadata = {
  title: "SympAI – TSE Copilot",
  description: "Close the hardware knowledge gap for Technical Sales Engineers."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
