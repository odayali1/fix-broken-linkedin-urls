# Why LinkedIn URLs break

A LinkedIn profile URL breaks because the slug changed. The member is often still on LinkedIn. The path saved in a CRM, ATS, or spreadsheet is the part that died.

## What changes the slug

LinkedIn lets a member edit the custom URL. The slug also changes when the name on the profile changes. Adding a certificate or another credential to the name is a common cause. The old `/in/old-slug` path then 404s.

## What still works

Send the old URL to [Fix Broken LinkedIn URLs](https://apify.com/oday/mawsool-fix-broken-linkedin-urls). The lookup is live. When the person can be recovered, `currentUrl` is the link that opens now, and the row includes the current headline, company, title, experience, and education.

On stale lists, recovery is often up to 70%. A URL that cannot be recovered is free. See [No match, no charge](no-match-no-charge.md).

## What to do with the row

| result | Action |
| --- | --- |
| Live profile, matchType exact or confident | Replace the stored URL and refresh the company and title. |
| Review this match, matchType likely | A person checks the name, company, and title first. |
| No match, free | Leave the old URL unresolved. |

An API key, if you need one outside Apify, comes from [mawsool.tech](https://mawsool.tech/). Questions: [osama@mawsool.tech](mailto:osama@mawsool.tech) or [info@mawsool.tech](mailto:info@mawsool.tech).
