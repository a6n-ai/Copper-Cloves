import Head from 'next/head';

import { cdnUrl } from "@/lib/cdnUrl";
interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_OG_IMAGE = cdnUrl("/the_studio_by_C_C_og.png");
const DEFAULT_TITLE = "The Studio by Copper + Cloves | Your Home Away From Home";
const DEFAULT_DESCRIPTION = "Move your body, refuel with a café bowl, and find your community. Expert-led wellness classes, plant-based café, and a sanctuary in the city.";
const FAVICON_SVG = cdnUrl("/favicon.svg");
const FAVICON_ICO = cdnUrl("/favicon.ico");

// SEO elements that can be used in _document.tsx (returns JSX without Head wrapper)
export function SEOElements({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  url,
}: Readonly<SEOProps>) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="icon" href={FAVICON_SVG} type="image/svg+xml" />
      <link rel="icon" href={FAVICON_ICO} sizes="any" />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </>
  );
}

// SEO component for use in pages/_app.tsx or individual pages (uses next/head)
// Note: Flattened structure (no fragment) for better Next.js Head compatibility during hot reload
export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  url,
}: Readonly<SEOProps>) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="icon" href={FAVICON_SVG} type="image/svg+xml" />
      <link rel="icon" href={FAVICON_ICO} sizes="any" />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Head>
  );
}
