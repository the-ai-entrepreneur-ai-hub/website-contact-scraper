# Website Contact Scraper — Extract Emails, Phones & Social Links from Any Website

Extract emails, phone numbers, social media profiles, physical addresses, and contact forms from any website. Automatically crawls homepage + contact/about pages. Detects tech stack (WordPress, Shopify, React, etc.). Built for B2B lead generation, sales prospecting, and contact enrichment.

[![Run on Apify](https://img.shields.io/badge/Run%20on-Apify-blue?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTQgMjhDMjEuNzMyIDI4IDI4IDIxLjczMiAyOCAxNEMyOCA2LjI2OCAyMS43MzIgMCAxNCAwQzYuMjY4IDAgMCA2LjI2OCAwIDE0QzAgMjEuNzMyIDYuMjY4IDI4IDE0IDI4WiIgZmlsbD0iIzk3RDdGRiIvPjwvc3ZnPg==)](https://apify.com/george.the.developer/website-contact-scraper-pro)
[![Available on RapidAPI](https://img.shields.io/badge/Also%20on-RapidAPI-blue?logo=rapidapi)](https://rapidapi.com/georgethedeveloper3046/api/website-contact-lead-scraper-api)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

## What It Does

Point it at any website URL, and it will:

1. **Scrape the homepage** for emails, phones, social links
2. **Discover contact/about pages** automatically (follows nav links, footer links, and tries common paths like `/contact`, `/about-us`, `/team`)
3. **Extract structured data** including schema.org addresses, mailto links, and social media profiles
4. **Detect tech stack** — identifies 25+ technologies (WordPress, Shopify, React, Google Analytics, HubSpot, Stripe, etc.)
5. **Classify emails** — separates personal (john.smith@), department (sales@), and generic (noreply@) emails

## What Data You Get

```json
{
  "url": "https://example.com",
  "companyName": "Example Corp",
  "emails": [
    { "email": "john.smith@example.com", "source": "contact", "type": "personal" },
    { "email": "sales@example.com", "source": "homepage", "type": "department" }
  ],
  "phones": [
    { "number": "(555) 123-4567", "source": "homepage", "type": "main" }
  ],
  "socialProfiles": {
    "linkedin": "https://linkedin.com/company/example-corp",
    "twitter": "https://x.com/examplecorp",
    "facebook": "https://facebook.com/examplecorp"
  },
  "address": "123 Main St, San Francisco, CA 94102",
  "contactFormUrl": "https://example.com/contact",
  "techStack": ["WordPress", "Google Analytics", "Mailchimp", "Cloudflare"],
  "pagesScraped": 4,
  "scrapedAt": "2026-03-10T15:00:00.000Z"
}
```

## Quick Start

### cURL

```bash
curl "https://api.apify.com/v2/acts/george.the.developer~website-contact-scraper-pro/run-sync-get-dataset-items?token=YOUR_API_TOKEN" \
  -X POST \
  -d '{
    "startUrls": [
      { "url": "https://example.com" },
      { "url": "https://another-site.com" }
    ],
    "maxPagesPerSite": 5
  }' \
  -H 'Content-Type: application/json'
```

### Node.js

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const run = await client.actor('george.the.developer/website-contact-scraper-pro').call({
    startUrls: [
        { url: 'https://example.com' },
        { url: 'https://another-site.com' },
    ],
    maxPagesPerSite: 5,
    extractTechStack: true,
    filterGenericEmails: true,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
items.forEach(site => {
    console.log(`\n${site.companyName} (${site.url})`);
    console.log(`  Emails: ${site.emails.map(e => e.email).join(', ')}`);
    console.log(`  Phones: ${site.phones.map(p => p.number).join(', ')}`);
    console.log(`  LinkedIn: ${site.socialProfiles.linkedin || 'N/A'}`);
});
```

### Python

```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

# Scrape contacts from a list of prospect websites
prospects = [
    "https://example.com",
    "https://another-site.com",
    "https://third-company.com",
]

run = client.actor("george.the.developer/website-contact-scraper-pro").call(run_input={
    "startUrls": [{"url": u} for u in prospects],
    "maxPagesPerSite": 5,
    "extractTechStack": True,
})

for site in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"\n{site['companyName']} — {site['url']}")
    for email in site["emails"]:
        print(f"  📧 {email['email']} ({email['type']})")
    for phone in site["phones"]:
        print(f"  📞 {phone['number']}")
```

## Use Cases

- **B2B Lead Generation** — Build prospect lists with verified contact data from company websites
- **Sales Prospecting** — Find decision-maker emails and phone numbers before outreach
- **Contact Enrichment** — Enrich your CRM with social profiles, tech stack, and addresses
- **Competitive Intelligence** — Analyze competitor tech stacks and marketing tools
- **Local Business Data** — Scrape contact info from local business websites at scale
- **Agency Lead Gen** — Identify businesses using outdated tech (pitch upgrade services)

## Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startUrls` | object[] | *required* | Website URLs to scrape |
| `maxPagesPerSite` | number | 5 | Pages to crawl per site (1-20) |
| `extractTechStack` | boolean | true | Detect website technologies |
| `filterGenericEmails` | boolean | true | Remove noreply@, admin@, etc. |
| `maxConcurrency` | number | 5 | Concurrent browser instances |
| `proxyConfiguration` | object | — | Proxy settings |

## Cost Comparison

| Method | Cost per 100 sites | Time | Data Quality |
|--------|-------------------|------|-------------|
| **This scraper** | **$1.00** | **5 min** | **High** |
| Manual research | $50-100 (labor) | 5+ hours | Medium |
| Hunter.io | $49/month (500 credits) | Varies | Email only |
| Apollo.io | $59/month | Varies | Good |

## Run on Apify

**[Run this actor on Apify](https://apify.com/george.the.developer/website-contact-scraper-pro)** — scrape 100 websites in minutes.

- **Cost**: ~$0.01 per website scraped
- **Speed**: 5-20 websites per minute (depending on site complexity)

## Also Available on RapidAPI

Prefer a standard REST API? This scraper is also available on **[RapidAPI](https://rapidapi.com/georgethedeveloper3046/api/website-contact-lead-scraper-api)** with simple API key authentication:

- **Free tier**: 20 requests/month
- **Pro**: $29/month (500 requests)
- **Ultra**: $79/month (2,000 requests)
- **Mega**: $199/month (10,000 requests)

## Limitations

- Only extracts publicly visible contact information. Does not access password-protected pages or private data.
- Email classification is heuristic-based — some edge cases may be misclassified.
- Tech stack detection covers 25+ popular technologies but may miss niche/custom solutions.

## Related Tools

- [Google News Scraper](https://github.com/the-ai-entrepreneur-ai-hub/google-news-scraper) — Monitor brand mentions across news sources
- [LinkedIn Employee Scraper](https://github.com/the-ai-entrepreneur-ai-hub/linkedin-employee-scraper) — Extract employee data from any company
- [YouTube Transcript Extractor](https://github.com/the-ai-entrepreneur-ai-hub/youtube-transcript-extractor) — Get video transcripts for AI/RAG
- [US Tariff Lookup](https://github.com/the-ai-entrepreneur-ai-hub/us-tariff-lookup) — Look up import duty rates & HS codes

## License

ISC License. See [LICENSE](LICENSE) for details.

---

Built by [george.the.developer](https://apify.com/george.the.developer) on [Apify](https://apify.com).
