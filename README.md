# Fix Broken LinkedIn URLs

**Fix a broken LinkedIn URL and get the live profile.** Paste an old, stale, or dead `linkedin.com/in/...` link. When the person is found, you get the current URL plus the headline, company, title, experience, and education, fetched at the moment you run. When nothing is found, you are not charged.

On stale lists, recovery is often up to 70%. Starting from [$1 per 1,000 live profiles](https://apify.com/oday/mawsool-fix-broken-linkedin-urls) on Apify. A miss is free.

Mawsool is not affiliated with LinkedIn.

## Run it

| What you want | Where |
| --- | --- |
| Run it now, no API key to manage | [Fix Broken LinkedIn URLs on Apify](https://apify.com/oday/mawsool-fix-broken-linkedin-urls) |
| An API key for Mawsool | [mawsool.tech](https://mawsool.tech/) · [Docs](https://docs.mawsool.tech/) · [Pricing](https://mawsool.tech/pricing) |
| A question about a list or a key | [osama@mawsool.tech](mailto:osama@mawsool.tech) · [info@mawsool.tech](mailto:info@mawsool.tech) |

The hosted Actor already includes access. You do not put a key in this repository. If you want a key for your own integration, request it from Mawsool. Do not open a GitHub issue with a key in it.

## No match, no charge

`result` is `No match, free` when no current profile is found. `charge` is `Free`. You pay only when a live profile comes back.

That is the point of running this on an old export. A file of 10,000 stale URLs that recovers 70% costs about 7,000 profiles, not 10,000. The rows that stay dead cost nothing.

## What you get back is live

This is a live request. The headline, company, title, and job history are the profile as it stands now, not a copy saved on the day the link was first collected.

A recovered row includes:

- The current LinkedIn URL
- Name, headline, and current title
- Current company and company URL
- Location and connections
- About and skills
- Experience, one object per role, with dates and the description
- Education, one object per school

| result | matchType | What to do |
| --- | --- | --- |
| `Live profile` | `exact` | The URL still matches this person. Keep it and use the fresh fields. |
| `Live profile` | `confident` | The old URL missed. Name, company, or title matched strongly. Write `currentUrl` back to the CRM. |
| `Review this match` | `likely` | A weaker match. Read the name, company, and title before you replace the URL. |
| `No match, free` | `none` | Nothing found. Leave the old URL unresolved. This row is free. |

## Who it is for

RevOps cleaning the LinkedIn URL field in HubSpot or Salesforce. Sales teams whose last-year list now 404s. Recruiters whose ATS still holds a candidate slug from before a name change or a new certificate. ABM teams whose buying-committee links died after a vanity URL edit.

Use it on old data. A URL that already opened this week belongs in a different Mawsool Actor:

| The URL you have | Open |
| --- | --- |
| Old, stale, or no longer opens | [Fix Broken LinkedIn URLs](https://apify.com/oday/mawsool-fix-broken-linkedin-urls) |
| Already opens, and you only want the current company and headline | [Profile Freshness Check](https://apify.com/oday/mawsool-linkedin-profile-freshness) |
| Already opens, and you stored the old company and want a comparison | [Current Company Checker](https://apify.com/oday/mawsool-linkedin-company-checker) |
| Already opens, and you want the full scrape | [LinkedIn Profile Scraper](https://apify.com/oday/mawsool-linkedin-profile-details) |

## Why the link 404s

A LinkedIn profile URL is a slug, not a permanent ID. Members can edit the custom URL. The slug also changes when the name changes, including when someone adds a certificate or a credential to their name. The old path stops opening. The person is often still on LinkedIn. The path in the CRM is the part that died.

More on that: [Why LinkedIn URLs break](docs/why-linkedin-urls-break.md).

## How to run a stale list

1. Export the LinkedIn URL column from HubSpot, Salesforce, Clay, an ATS, or a spreadsheet.
2. Open the [Actor](https://apify.com/oday/mawsool-fix-broken-linkedin-urls) and paste the column, or upload the CSV. A header of `url` or `linkedinUrl` is enough.
3. Run it.
4. Keep rows where `result` is `Live profile`.
5. Hold `Review this match` for a person to check.
6. Leave `No match, free` unresolved.

```bash
apify call oday/mawsool-fix-broken-linkedin-urls --input '{
  "urls": ["https://www.linkedin.com/in/old-or-broken-slug"]
}'
```

For an agent that can call Apify:

```text
Use oday/mawsool-fix-broken-linkedin-urls on old, stale, or broken LinkedIn URLs. This is a live lookup. When result is "Live profile", return currentUrl, headline, company, jobTitle, experience, and education, and replace the stored URL. When result is "Review this match", show the name, company, and title and wait. When result is "No match, free", do not charge and do not invent a URL. Starting from $1 per 1,000 live profiles.
```

## What a row contains

Every row uses the same fields. A miss leaves them empty and sets `charge` to `Free`.

```json
{
  "inputUrl": "https://www.linkedin.com/in/old-or-broken-slug",
  "currentUrl": "https://www.linkedin.com/in/current-slug",
  "result": "Live profile",
  "matchType": "confident",
  "fullName": "Jordan Hale",
  "firstName": "Jordan",
  "lastName": "Hale",
  "headline": "VP Sales at Northwind",
  "jobTitle": "VP Sales",
  "company": "Northwind",
  "companyLinkedInUrl": "https://www.linkedin.com/company/northwind",
  "location": "Austin, Texas, United States",
  "connections": "500+",
  "about": "Leads the sales team at Northwind.",
  "skills": "Enterprise Sales; CRM; Forecasting",
  "skillsCount": 3,
  "experienceCount": 2,
  "experience": [
    {
      "title": "VP Sales",
      "company": "Northwind",
      "companyUrl": "https://www.linkedin.com/company/northwind",
      "start": "2022-03",
      "end": "Present",
      "description": "Owns the revenue number."
    }
  ],
  "educationCount": 1,
  "education": [
    {
      "school": "State University",
      "degree": "Bachelor's degree",
      "field": "Business Administration",
      "start": "2010",
      "end": "2014",
      "schoolUrl": "https://www.linkedin.com/school/state-university"
    }
  ],
  "checkedAt": "2026-10-29T12:00:00.000Z",
  "charge": "Charged"
}
```

## Price on Apify

One charge per live profile. `exact`, `confident`, and `likely` are recoveries. A not-found row is free. A failed request is free.

| Plan | Per 1,000 live profiles |
| --- | --- |
| Free | $1.80 |
| Bronze | $1.50 |
| Silver | $1.20 |
| Gold, Platinum, Diamond | $1.00 |

API access is separate. Get a key from [Mawsool](https://mawsool.tech/) or write to [info@mawsool.tech](mailto:info@mawsool.tech).

## Answers

### How do I fix a broken LinkedIn URL?

Paste the old `linkedin.com/in/...` link, including a link that no longer opens, into the [Actor](https://apify.com/oday/mawsool-fix-broken-linkedin-urls). When `result` is `Live profile`, `currentUrl` is the link that opens now.

### Do I pay if the old URL cannot be recovered?

No. [No match, no charge](docs/no-match-no-charge.md).

### Is the company and the job history current?

Yes. [The profile is live](docs/live-linkedin-profile.md). `checkedAt` is the time of that request.

### Should I run this on a URL that already opens?

Save it for old or broken links. A URL that already opens is cheaper on [Profile Freshness Check](https://apify.com/oday/mawsool-linkedin-profile-freshness) when you only need the current company and headline.

## This repository

The source shows what the hosted Actor does. It does not contain an API key, and it should never receive one. Production runs on Apify.

- [AGENTS.md](AGENTS.md) for an agent that lands in this repo
- [llms.txt](llms.txt) for a short machine-readable summary
- [Security](SECURITY.md)

Mawsool International. [mawsool.tech](https://mawsool.tech/)
