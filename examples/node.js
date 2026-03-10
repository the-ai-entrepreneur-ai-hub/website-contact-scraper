/**
 * Website Contact Scraper — Node.js Example
 *
 * Extract emails, phones, social links from any website.
 * Get your API token at: https://console.apify.com/settings/integrations
 */
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const run = await client.actor('george.the.developer/website-contact-scraper-pro').call({
    startUrls: [
        { url: 'https://example.com' },
        { url: 'https://another-company.com' },
    ],
    maxPagesPerSite: 5,
    extractTechStack: true,
    filterGenericEmails: true,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();

items.forEach(site => {
    console.log(`\n${site.companyName} (${site.url})`);
    console.log(`  Emails: ${site.emails.map(e => e.email).join(', ') || 'None found'}`);
    console.log(`  Phones: ${site.phones.map(p => p.number).join(', ') || 'None found'}`);
    console.log(`  LinkedIn: ${site.socialProfiles?.linkedin || 'N/A'}`);
    console.log(`  Tech: ${site.techStack?.join(', ') || 'N/A'}`);
});
