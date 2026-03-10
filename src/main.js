import { Actor, log } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

// ── Regex patterns ──────────────────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
const ZIP_STATE_RE = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

const GENERIC_EMAIL_PREFIXES = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'webmaster', 'admin', 'administrator', 'postmaster',
    'mailer-daemon', 'hostmaster', 'root', 'abuse',
];

const DEPARTMENT_PREFIXES = [
    'sales', 'info', 'support', 'help', 'contact', 'hello',
    'team', 'hr', 'jobs', 'careers', 'press', 'media',
    'marketing', 'billing', 'legal', 'privacy', 'security',
    'feedback', 'office', 'general', 'service', 'customer',
];

const SOCIAL_DOMAINS = {
    linkedin: ['linkedin.com/company/', 'linkedin.com/in/'],
    twitter: ['twitter.com/', 'x.com/'],
    facebook: ['facebook.com/', 'fb.com/'],
    instagram: ['instagram.com/'],
    youtube: ['youtube.com/channel/', 'youtube.com/c/', 'youtube.com/@', 'youtube.com/user/'],
};

const TECH_SIGNATURES = [
    { pattern: /wp-content|wp-includes|wordpress/i, name: 'WordPress' },
    { pattern: /cdn\.shopify\.com|shopify/i, name: 'Shopify' },
    { pattern: /react|__next/i, name: 'React' },
    { pattern: /angular/i, name: 'Angular' },
    { pattern: /vue\.js|vuejs/i, name: 'Vue.js' },
    { pattern: /jquery/i, name: 'jQuery' },
    { pattern: /bootstrap/i, name: 'Bootstrap' },
    { pattern: /tailwindcss|tailwind/i, name: 'Tailwind CSS' },
    { pattern: /google-analytics|gtag|googletagmanager/i, name: 'Google Analytics' },
    { pattern: /googleads|adwords/i, name: 'Google Ads' },
    { pattern: /facebook\.net|fbevents|fb-pixel/i, name: 'Facebook Pixel' },
    { pattern: /hotjar/i, name: 'Hotjar' },
    { pattern: /hubspot/i, name: 'HubSpot' },
    { pattern: /mailchimp|mc\.js/i, name: 'Mailchimp' },
    { pattern: /intercom/i, name: 'Intercom' },
    { pattern: /zendesk/i, name: 'Zendesk' },
    { pattern: /drift/i, name: 'Drift' },
    { pattern: /wix\.com/i, name: 'Wix' },
    { pattern: /squarespace/i, name: 'Squarespace' },
    { pattern: /cloudflare/i, name: 'Cloudflare' },
    { pattern: /stripe\.com|stripe\.js/i, name: 'Stripe' },
    { pattern: /segment\.com|segment\.io/i, name: 'Segment' },
    { pattern: /recaptcha/i, name: 'reCAPTCHA' },
    { pattern: /clarity\.ms/i, name: 'Microsoft Clarity' },
    { pattern: /typeform/i, name: 'Typeform' },
    { pattern: /calendly/i, name: 'Calendly' },
];

const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/get-in-touch', '/reach-us'];

// ── Helper functions ────────────────────────────────────────────────────────

function classifyEmail(email) {
    const local = email.split('@')[0].toLowerCase();
    if (DEPARTMENT_PREFIXES.some((p) => local === p)) return 'department';
    if (/[._-]/.test(local) && /[a-z]{2,}[._-][a-z]{2,}/.test(local)) return 'personal';
    return 'generic';
}

function isGenericEmail(email) {
    const local = email.split('@')[0].toLowerCase();
    return GENERIC_EMAIL_PREFIXES.some((p) => local === p || local.startsWith(`${p}+`));
}

function normalizeUrl(href, baseUrl) {
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return null;
    }
}

function domainOf(urlStr) {
    try {
        return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

// ── Page-level extraction (runs in browser context) ─────────────────────────

async function extractPageData(page, pageUrl, sourceName) {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const html = await page.content();

    // Emails
    const textEmails = bodyText.match(EMAIL_RE) || [];
    const mailtoEmails = await page.$$eval('a[href^="mailto:"]', (els) =>
        els.map((el) => {
            const href = el.getAttribute('href') || '';
            const match = href.replace('mailto:', '').split('?')[0].trim();
            return match;
        }),
    );
    const rawEmails = [...new Set([...textEmails, ...mailtoEmails])].filter(
        (e) => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.gif') && e.includes('.'),
    );

    // Phones
    const rawPhones = [...new Set(bodyText.match(PHONE_RE) || [])];

    // Social profiles
    const socialLinks = await page.$$eval('a[href]', (els) =>
        els.map((el) => el.getAttribute('href')).filter(Boolean),
    );

    // Contact form detection
    const hasForm = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        for (const f of forms) {
            const text = (f.innerText || '').toLowerCase();
            const action = (f.getAttribute('action') || '').toLowerCase();
            if (
                text.includes('message') || text.includes('contact') || text.includes('email') ||
                text.includes('name') || action.includes('contact') || action.includes('form')
            ) return true;
        }
        return false;
    });

    // Address extraction – schema.org first, then heuristic
    const schemaAddress = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of scripts) {
            try {
                const data = JSON.parse(s.textContent);
                const addr = data.address || data?.location?.address;
                if (addr && addr.streetAddress) {
                    return [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
                        .filter(Boolean).join(', ');
                }
            } catch { /* ignore */ }
        }
        return null;
    });

    let address = schemaAddress;
    if (!address) {
        // Try to find a street-address-like block from text
        const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (ZIP_STATE_RE.test(line) && /\d+\s+\w+/.test(line) && line.length < 200) {
                address = line.replace(/\s+/g, ' ').trim();
                break;
            }
        }
    }

    // Tech stack from HTML source
    const techStack = [];
    for (const sig of TECH_SIGNATURES) {
        if (sig.pattern.test(html)) techStack.push(sig.name);
    }

    // Company name from meta / title
    const companyName = await page.evaluate(() => {
        const ogSite = document.querySelector('meta[property="og:site_name"]');
        if (ogSite) return ogSite.getAttribute('content');
        const title = document.title || '';
        // Take first segment before separator
        const seg = title.split(/[|\-–—:]/)[0].trim();
        return seg || null;
    });

    return { rawEmails, rawPhones, socialLinks, hasForm, address, techStack, companyName, sourceName };
}

// ── Discover internal contact / about pages ─────────────────────────────────

async function discoverContactPages(page, baseUrl, maxPages) {
    const baseDomain = domainOf(baseUrl);
    const found = new Set();

    // 1. Try known paths
    for (const p of CONTACT_PATHS) {
        const candidate = normalizeUrl(p, baseUrl);
        if (candidate) found.add(candidate);
    }

    // 2. Scan footer and nav links for contact-related anchors
    const pageLinks = await page.$$eval('a[href]', (els) =>
        els.map((el) => ({
            href: el.getAttribute('href'),
            text: (el.innerText || '').toLowerCase().trim(),
        })),
    );

    for (const { href, text } of pageLinks) {
        if (!href) continue;
        const full = normalizeUrl(href, baseUrl);
        if (!full || domainOf(full) !== baseDomain) continue;
        if (
            /contact|about|team|people|staff|leadership|get-in-touch|reach/i.test(text) ||
            /contact|about|team/i.test(href)
        ) {
            found.add(full);
        }
    }

    // Limit to maxPages (minus 1 for homepage already visited)
    return [...found].slice(0, maxPages - 1);
}

// ── Main ────────────────────────────────────────────────────────────────────

await Actor.init();

const input = await Actor.getInput() || {};
const {
    startUrls = [],
    maxPagesPerSite = 5,
    extractTechStack = true,
    filterGenericEmails = true,
    maxConcurrency = 5,
    proxyConfiguration,
} = input;

if (!startUrls.length) {
    throw new Error('No startUrls provided. Please add at least one website URL.');
}

const proxyConfig = proxyConfiguration
    ? await Actor.createProxyConfiguration(proxyConfiguration)
    : undefined;

// Store accumulated data per root domain
const siteData = {}; // keyed by root URL

function ensureSite(rootUrl) {
    if (!siteData[rootUrl]) {
        siteData[rootUrl] = {
            url: rootUrl,
            companyName: null,
            emails: new Map(),
            phones: new Map(),
            socialProfiles: {},
            addresses: [],
            contactFormUrl: null,
            techStack: new Set(),
            pagesVisited: 0,
        };
    }
    return siteData[rootUrl];
}

const crawler = new PuppeteerCrawler({
    proxyConfiguration: proxyConfig,
    maxConcurrency,
    navigationTimeoutSecs: 60,
    requestHandlerTimeoutSecs: 120,
    maxRequestRetries: 2,
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
    },

    async requestHandler({ request, page, enqueueLinks }) {
        const rootUrl = request.userData.rootUrl || request.url;
        const isHomepage = request.userData.isHomepage !== false;
        const sourceName = request.userData.sourceName || 'homepage';
        const site = ensureSite(rootUrl);

        site.pagesVisited++;
        log.info(`Scraping [${sourceName}] ${request.url} (page ${site.pagesVisited} for ${domainOf(rootUrl)})`);

        await page.waitForSelector('body', { timeout: 15000 }).catch(() => {});

        const data = await extractPageData(page, request.url, sourceName);

        // Merge emails
        for (const email of data.rawEmails) {
            const lower = email.toLowerCase();
            if (filterGenericEmails && isGenericEmail(lower)) continue;
            if (!site.emails.has(lower)) {
                site.emails.set(lower, {
                    email: lower,
                    source: sourceName,
                    type: classifyEmail(lower),
                });
            }
        }

        // Merge phones
        for (const phone of data.rawPhones) {
            const normalized = phone.replace(/[\s.-]/g, '').replace(/^\+?1/, '+1-');
            if (!site.phones.has(normalized)) {
                site.phones.set(normalized, {
                    number: phone.trim(),
                    source: sourceName,
                    type: sourceName === 'homepage' ? 'main' : 'secondary',
                });
            }
        }

        // Social profiles
        for (const href of data.socialLinks) {
            for (const [platform, patterns] of Object.entries(SOCIAL_DOMAINS)) {
                if (!site.socialProfiles[platform] && patterns.some((p) => href.includes(p))) {
                    // Clean up the URL
                    try {
                        const cleaned = new URL(href);
                        // Skip share/sharer/intent links
                        if (/share|sharer|intent/i.test(cleaned.pathname)) continue;
                        site.socialProfiles[platform] = cleaned.origin + cleaned.pathname.replace(/\/+$/, '');
                    } catch { /* ignore */ }
                }
            }
        }

        // Address
        if (data.address && !site.addresses.includes(data.address)) {
            site.addresses.push(data.address);
        }

        // Contact form
        if (data.hasForm && !site.contactFormUrl) {
            site.contactFormUrl = request.url;
        }

        // Tech stack
        if (extractTechStack) {
            for (const tech of data.techStack) site.techStack.add(tech);
        }

        // Company name (prefer homepage)
        if (data.companyName && (!site.companyName || isHomepage)) {
            site.companyName = data.companyName;
        }

        // Discover and enqueue contact/about pages from homepage
        if (isHomepage && site.pagesVisited < maxPagesPerSite) {
            const contactPages = await discoverContactPages(page, rootUrl, maxPagesPerSite);
            for (const cpUrl of contactPages) {
                if (site.pagesVisited >= maxPagesPerSite) break;
                const pathSegment = new URL(cpUrl).pathname.replace(/^\//, '').replace(/\//g, ' ').trim() || 'subpage';
                await crawler.addRequests([{
                    url: cpUrl,
                    userData: {
                        rootUrl,
                        isHomepage: false,
                        sourceName: pathSegment,
                    },
                    uniqueKey: cpUrl,
                }]);
            }
        }
    },

    async failedRequestHandler({ request }, error) {
        log.warning(`Failed to scrape ${request.url}: ${error.message}`);
    },
});

// Build initial request list
const requests = startUrls.map((entry) => {
    const url = entry.url || entry;
    return {
        url,
        userData: { rootUrl: url, isHomepage: true, sourceName: 'homepage' },
        uniqueKey: `home-${url}`,
    };
});

await crawler.run(requests);

// ── Finalize and push results ───────────────────────────────────────────────

log.info(`Scraping complete. Processing ${Object.keys(siteData).length} site(s)...`);

for (const [rootUrl, site] of Object.entries(siteData)) {
    const result = {
        url: rootUrl,
        companyName: site.companyName || domainOf(rootUrl),
        emails: [...site.emails.values()],
        phones: [...site.phones.values()],
        socialProfiles: site.socialProfiles,
        address: site.addresses[0] || null,
        contactFormUrl: site.contactFormUrl,
        techStack: extractTechStack ? [...site.techStack].sort() : [],
        pagesScraped: site.pagesVisited,
        scrapedAt: new Date().toISOString(),
    };

    await Actor.pushData(result);

    try {
        await Actor.charge(1, { eventName: 'site-scraped' });
    } catch (err) {
        log.warning(`PPE charge failed: ${err.message}`);
    }

    log.info(`✓ ${domainOf(rootUrl)}: ${result.emails.length} emails, ${result.phones.length} phones, ${Object.keys(result.socialProfiles).length} social profiles`);
}

log.info('All done!');
await Actor.exit();
