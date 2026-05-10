import { query } from '@/lib/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ outletId: string }>;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  body: string | null;
  sort_order: number;
}

interface Outlet {
  id: string;
  name: string;
  location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  portal_color_scheme: Record<string, string> | null;
}

interface Company {
  id: string;
  name: string;
  address: string | null;
}

async function getData(outletId: string) {
  const outletRes = await query(
    `SELECT id, name, location, contact_phone, contact_email, portal_color_scheme, company_id
     FROM outlets WHERE id = $1 LIMIT 1`,
    [outletId]
  );
  if (!outletRes.rows.length) return null;

  const outlet: Outlet & { company_id: string } = outletRes.rows[0];

  const [companyRes, entriesRes] = await Promise.all([
    query('SELECT id, name, address FROM companies WHERE id = $1 LIMIT 1', [outlet.company_id]),
    query(
      `SELECT id, category, title, body, sort_order
       FROM knowledge_entries
       WHERE company_id = $1 AND (outlet_id = $2 OR outlet_id IS NULL) AND active = true
       ORDER BY category, sort_order ASC`,
      [outlet.company_id, outletId]
    ),
  ]);

  const company: Company = companyRes.rows[0] || { id: outlet.company_id, name: outlet.name, address: null };
  const entries: KnowledgeEntry[] = entriesRes.rows;

  return { outlet, company, entries };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { outletId } = await params;
  const data = await getData(outletId);
  if (!data) return { title: 'Not Found' };
  const { outlet, company } = data;
  const name = outlet.name || company.name;
  return {
    title: `${name} — Info & FAQ`,
    description: `Learn about ${name}: location, hours, frequently asked questions, and highlights.`,
  };
}

export default async function KnowledgePage({ params }: PageProps) {
  const { outletId } = await params;
  const data = await getData(outletId);
  if (!data) notFound();

  const { outlet, company, entries } = data;
  const cs = outlet.portal_color_scheme || {};
  const primary = cs.primary || '#1A1A1A';
  const bgColor = cs.bgColor || '#FAFAFA';
  const surfaceColor = cs.surfaceColor || '#FFFFFF';
  const textColor = cs.textColor || '#1A1A1A';
  const fontFamily = cs.fontFamily || 'Inter, sans-serif';

  const faqs = entries.filter(e => e.category === 'faq');
  const highlights = entries.filter(e => e.category === 'highlight');

  const businessName = outlet.name || company.name;
  const address = outlet.location || company.address || '';

  // JSON-LD: FAQPage + LocalBusiness
  const faqJsonLd = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
          '@type': 'Question',
          name: faq.title,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.body || '',
          },
        })),
      }
    : null;

  const businessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
    },
    ...(outlet.contact_phone ? { telephone: outlet.contact_phone } : {}),
    ...(outlet.contact_email ? { email: outlet.contact_email } : {}),
    ...(highlights.length > 0
      ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Highlights', itemListElement: highlights.map(h => ({ '@type': 'Offer', name: h.title, description: h.body || undefined })) } }
      : {}),
  };

  return (
    <div style={{ backgroundColor: bgColor, minHeight: '100vh', fontFamily, color: textColor }}>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Header */}
      <div
        className="px-6 py-10 text-white text-center"
        style={{ backgroundColor: primary }}
      >
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black shadow-lg mb-4"
          style={{ backgroundColor: surfaceColor, color: primary }}
        >
          {businessName[0]}
        </div>
        <h1 className="text-3xl font-black tracking-tight">{businessName}</h1>
        {address && <p className="text-white/70 text-sm mt-1">{address}</p>}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm text-white/80">
          {outlet.contact_phone && <span>{outlet.contact_phone}</span>}
          {outlet.contact_email && <span>{outlet.contact_email}</span>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Highlights */}
        {highlights.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4" style={{ color: textColor }}>Highlights</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {highlights.map(h => (
                <div
                  key={h.id}
                  className="rounded-2xl p-4 border"
                  style={{ backgroundColor: surfaceColor, borderColor: `${primary}20` }}
                >
                  <p className="font-semibold text-sm" style={{ color: textColor }}>{h.title}</p>
                  {h.body && (
                    <p className="text-sm mt-1" style={{ color: `${textColor}99` }}>{h.body}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faqs.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-4" style={{ color: textColor }}>Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map(faq => (
                <details
                  key={faq.id}
                  className="group rounded-2xl border overflow-hidden"
                  style={{ backgroundColor: surfaceColor, borderColor: `${primary}20` }}
                >
                  <summary
                    className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-sm list-none"
                    style={{ color: textColor }}
                  >
                    {faq.title}
                    <svg
                      className="w-4 h-4 shrink-0 ml-3 transition-transform group-open:rotate-180"
                      style={{ color: `${textColor}60` }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  {faq.body && (
                    <div className="px-5 pb-4 text-sm" style={{ color: `${textColor}99` }}>
                      {faq.body}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {faqs.length === 0 && highlights.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: `${textColor}60` }}>No information published yet.</p>
          </div>
        )}

        {/* Back link */}
        <div className="pt-4 border-t" style={{ borderColor: `${primary}15` }}>
          <Link
            href={`/p/${outletId}`}
            className="text-sm font-medium"
            style={{ color: primary }}
          >
            ← Back to {businessName}
          </Link>
        </div>
      </div>
    </div>
  );
}
