# The recovered LinkedIn profile is live

A recovered row is not a stored copy of the profile from the day the URL was first saved. Each URL is resolved when the run starts. `checkedAt` is that time.

## Fields that are current

- `currentUrl`, the profile link that opens now
- `headline`
- `jobTitle` and `company`
- `companyLinkedInUrl`
- `location` and `connections`
- `about` and `skills`
- `experience`, one object per role, with start, end, and description
- `education`, one object per school, with degree and field

`result` = `Live profile` with `matchType` `exact` or `confident` is the row to write back. `Review this match` still includes those live fields, and a person should confirm the name, company, and title before replacing the URL.

## When you only need two fields

If the URL already opens and you only want the current company and headline, use [Profile Freshness Check](https://apify.com/oday/mawsool-linkedin-profile-freshness), starting from $0.40 per 1,000. If the URL itself is old or broken, start with [Fix Broken LinkedIn URLs](https://apify.com/oday/mawsool-fix-broken-linkedin-urls). A miss is free.

API keys: [mawsool.tech](https://mawsool.tech/). [osama@mawsool.tech](mailto:osama@mawsool.tech) · [info@mawsool.tech](mailto:info@mawsool.tech).
