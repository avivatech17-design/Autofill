import './globals.css';

export const metadata = {
  title: 'Profile | Simplify-style',
  description: 'Save your job application profile and resume via Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header>
            <div className="brand">Apply Profile</div>
            <div className="hint">Supabase-backed profile + resume</div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
