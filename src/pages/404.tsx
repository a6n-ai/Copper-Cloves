import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from "@/components/ui/button"

import { cdnUrl } from "@/lib/cdnUrl";
export default function NotFound() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found</title>
        <meta name="description" content="Page not found" />
        <link rel="icon" href={cdnUrl("/favicon.svg")} type="image/svg+xml" />
        <link rel="icon" href={cdnUrl("/favicon.ico")} sizes="any" />
      </Head>
      
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-5">
          <p className="font-body text-xs uppercase tracking-[0.25em] text-terracotta/80">Lost your way?</p>
          <h1 className="font-display text-6xl sm:text-7xl text-charcoal leading-none">404</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed">
            We couldn't find that page. It may have moved, been retired, or never existed. Let's get you back home.
          </p>
          <Button asChild variant="sage">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </main>
    </>
  )
}
