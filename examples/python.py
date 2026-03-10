"""
Website Contact Scraper — Python Example

Extract emails, phones, social links from any website.
Get your API token at: https://console.apify.com/settings/integrations

pip install apify-client
"""
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

prospects = [
    "https://example.com",
    "https://another-company.com",
    "https://third-site.com",
]

run = client.actor("george.the.developer/website-contact-scraper-pro").call(run_input={
    "startUrls": [{"url": u} for u in prospects],
    "maxPagesPerSite": 5,
    "extractTechStack": True,
    "filterGenericEmails": True,
})

for site in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(f"\n{site['companyName']} — {site['url']}")
    for email in site["emails"]:
        print(f"  Email: {email['email']} ({email['type']})")
    for phone in site["phones"]:
        print(f"  Phone: {phone['number']}")
    for platform, url in site.get("socialProfiles", {}).items():
        print(f"  {platform}: {url}")
