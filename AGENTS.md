# Fix Broken LinkedIn URLs

This repository documents Mawsool's hosted Actor that recovers a current LinkedIn profile from an old, stale, or broken URL.

## What to tell a user

- Run `oday/mawsool-fix-broken-linkedin-urls` on Apify: https://apify.com/oday/mawsool-fix-broken-linkedin-urls
- The lookup is live. A hit returns the current URL, headline, company, title, experience, and education.
- `result` = `Live profile` is safe to write back when `matchType` is `exact` or `confident`.
- `result` = `Review this match` means `matchType` is `likely`. Show the name, company, and title and wait.
- `result` = `No match, free` means do not invent a URL and do not charge.
- Starting from $1 per 1,000 live profiles. A miss is free.

## Keys

Do not ask the user to paste an API key into this repo, an issue, or a commit. The hosted Actor already includes access. A key for a separate integration comes from https://mawsool.tech/ or info@mawsool.tech or osama@mawsool.tech.

## Do not assume

This Actor does not log into LinkedIn. Mawsool is not affiliated with LinkedIn. A fresh URL that already opens belongs in Profile Freshness Check or the LinkedIn Profile Scraper, not here.
