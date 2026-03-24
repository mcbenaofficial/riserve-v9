import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import pool from "@/lib/db";

const inter = Inter({ subsets: ["latin"] });

// Kosmo Cafe company ID
const COMPANY_ID = '3821aa11-8386-452d-b6be-174ef77d1970';

export async function generateMetadata(): Promise<Metadata> {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT name FROM companies WHERE id = $1 LIMIT 1', [COMPANY_ID]);
    const name = res.rows[0]?.name || 'Kosmo Cafe';
    return {
      title: name,
      description: `Order online from ${name}`,
    };
  } catch {
    return { title: 'Kosmo Cafe', description: 'Order online from Kosmo Cafe' };
  } finally {
    client.release();
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </body>
    </html>
  );
}
