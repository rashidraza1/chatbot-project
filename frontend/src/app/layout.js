import "./globals.css";

export const metadata = {
  title: "AI Chatbot Platform",
  description: "Next-gen embedded chatbot platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
