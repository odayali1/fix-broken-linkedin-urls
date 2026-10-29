import { Actor, log } from 'apify';
import { createHash } from 'node:crypto';

type Input = {
    urls?: string[];
    urlsCsv?: string;
    fileUrl?: string;
    maxUrls?: number;
    concurrency?: number;
    resumeId?: string;
    freshStart?: boolean;
};

type Outcome = 'recovered' | 'not_found' | 'failed';

const API_BASE = (process.env.CUAPI_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.CUAPI_API_KEY?.trim();
const EVENT = 'linkedin-url-recovered';
const DIRECT_ATTEMPTS = 5;
const LOOKUP_TIMEOUT_MS = 45_000;
const HARD_MAX = 1_000_000;

function textOrNull(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
}

function datePart(value: unknown): string | null {
    const part = asRecord(value);
    if (!part || typeof part.year !== 'number') return null;
    if (typeof part.month !== 'number') return String(part.year);
    return `${part.year}-${String(part.month).padStart(2, '0')}`;
}

function rangeOf(value: unknown): { start: string | null; end: string | null } {
    const range = asRecord(value);
    const start = datePart(range?.start);
    const end = datePart(range?.end);
    return { start, end: end || (start ? 'Present' : null) };
}

function experienceOf(profile: Record<string, unknown>): Record<string, unknown>[] {
    const positions = asRecord(profile.positions);
    return asRecords(positions?.positionHistory).map((role) => {
        const dates = rangeOf(role.startEndDate);
        const company = asRecord(role.company);
        return {
            title: textOrNull(role.title),
            company: textOrNull(role.companyName) || textOrNull(company?.companyName),
            companyUrl: textOrNull(role.linkedInUrl) || textOrNull(company?.linkedInUrl),
            start: dates.start,
            end: dates.end,
            description: textOrNull(role.description),
        };
    });
}

function educationOf(profile: Record<string, unknown>): Record<string, unknown>[] {
    const schools = asRecord(profile.schools);
    return asRecords(schools?.educationHistory).map((item) => {
        const dates = rangeOf(item.startEndDate);
        const school = asRecord(item.school);
        return {
            school: textOrNull(item.schoolName) || textOrNull(school?.schoolName),
            degree: textOrNull(item.degreeName),
            field: textOrNull(item.fieldOfStudy),
            start: dates.start,
            end: dates.end,
            schoolUrl: textOrNull(item.linkedInUrl) || textOrNull(school?.linkedInUrl),
        };
    });
}

function skillsOf(profile: Record<string, unknown>): string | null {
    if (!Array.isArray(profile.skills)) return null;
    const skills = profile.skills.filter((item): item is string => typeof item === 'string' && !!item.trim());
    return skills.length ? skills.join('; ') : null;
}

function connectionsOf(profile: Record<string, unknown>): string | null {
    if (typeof profile.connectionCount !== 'number') return null;
    return profile.isConnectionCountObfuscated ? `${profile.connectionCount}+` : String(profile.connectionCount);
}

function slugOf(raw: string): string {
    try {
        const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        const match = url.pathname.match(/\/in\/([^/]+)/i);
        return match ? decodeURIComponent(match[1]).replace(/\/+$/, '').toLowerCase() : '';
    } catch {
        return '';
    }
}

function normalizeUrl(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value) return null;
    try {
        const url = new URL(value.startsWith('http') ? value : `https://${value}`);
        if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || !url.pathname.toLowerCase().includes('/in/')) return null;
        const slug = decodeURIComponent(url.pathname.match(/\/in\/([^/]+)/i)?.[1] || '').replace(/\/+$/, '');
        if (!slug) return null;
        return `https://www.linkedin.com/in/${slug}`;
    } catch {
        return null;
    }
}

function parseCsv(text: string): string[] {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const split = (line: string) => line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
    const first = split(lines[0]).map((part) => part.toLowerCase());
    const names = ['url', 'linkedinurl', 'linkedin_url', 'profileurl', 'profile_url', 'linkedin'];
    const hasHeader = first.some((part) => names.includes(part));
    const urlIndex = hasHeader ? Math.max(first.findIndex((part) => names.includes(part)), 0) : 0;
    return lines.slice(hasHeader ? 1 : 0).map((line) => split(line)[urlIndex] || '');
}

async function collectUrls(input: Input): Promise<string[]> {
    const raw: string[] = [...(input.urls || [])];
    if (input.urlsCsv) raw.push(...parseCsv(input.urlsCsv));
    if (input.fileUrl) {
        const response = await fetch(input.fileUrl, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Could not download input file (HTTP ${response.status}).`);
        raw.push(...parseCsv(await response.text()));
    }
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const value of raw) {
        const url = normalizeUrl(value);
        if (!url || seen.has(url.toLowerCase())) continue;
        seen.add(url.toLowerCase());
        urls.push(url);
    }
    return urls;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanError(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : fallback;
    return message.replace(/https?:\/\/\S+/gi, 'the lookup service');
}

function permanentStatus(status: number): boolean {
    return status === 400 || status === 401 || status === 402 || status === 403 || status === 404 || status === 409;
}

function stalled(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return error.name === 'TimeoutError' || error.name === 'AbortError' || message.includes('fetch failed') || message.includes('network') || message.includes('timed out');
}

type Lookup =
    | { kind: 'hit'; body: Record<string, unknown> }
    | { kind: 'miss' }
    | { kind: 'stop'; message: string };

async function resolveUrl(url: string): Promise<Lookup> {
    let lastError = 'Lookup failed';
    for (let attempt = 0; attempt < DIRECT_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${API_BASE}/v1/profiles/resolve`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mawsool-Apify-url-recovery/1.0',
                    'x-api-key': API_KEY!,
                },
                body: JSON.stringify({ linkedinUrl: url }),
                signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            });
            const text = await response.text();
            let body: Record<string, unknown> | null = null;
            try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* handled below */ }
            if (response.status === 404) return { kind: 'miss' };
            if (response.status === 401 || response.status === 402) {
                return { kind: 'stop', message: response.status === 402 ? 'The lookup service has no credits left.' : 'The lookup service rejected the API key.' };
            }
            if (response.ok && body) return { kind: 'hit', body };
            lastError = body && typeof body.error === 'string' ? body.error : `API returned HTTP ${response.status}`;
            if (permanentStatus(response.status)) break;
            log.warning(`Resolve attempt ${attempt + 1} of ${DIRECT_ATTEMPTS} did not succeed. Retrying.`);
        } catch (error) {
            lastError = stalled(error) ? 'The lookup did not answer in time.' : cleanError(error, 'Network request failed');
            log.warning(`Resolve attempt ${attempt + 1} of ${DIRECT_ATTEMPTS} did not succeed. Retrying.`);
        }
        if (attempt < DIRECT_ATTEMPTS - 1) await sleep(Math.min(8000, 1000 * (2 ** attempt)));
    }
    throw new Error(lastError.replace(/https?:\/\/\S+/gi, 'the lookup service'));
}

function profileRow(
    inputUrl: string,
    fields: {
        currentUrl: string | null;
        result: string;
        matchType: string;
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
        headline: string | null;
        jobTitle: string | null;
        company: string | null;
        companyLinkedInUrl: string | null;
        location: string | null;
        connections: string | null;
        about: string | null;
        skills: string | null;
        skillsCount: number | null;
        experience: Record<string, unknown>[];
        education: Record<string, unknown>[];
        checkedAt: string;
        charge: 'Charged' | 'Free';
        chargeable: boolean;
    },
): Record<string, unknown> {
    return {
        inputUrl,
        currentUrl: fields.currentUrl,
        result: fields.result,
        matchType: fields.matchType,
        fullName: fields.fullName,
        firstName: fields.firstName,
        lastName: fields.lastName,
        headline: fields.headline,
        jobTitle: fields.jobTitle,
        company: fields.company,
        companyLinkedInUrl: fields.companyLinkedInUrl,
        location: fields.location,
        connections: fields.connections,
        about: fields.about,
        skills: fields.skills,
        skillsCount: fields.skillsCount,
        experienceCount: fields.experience.length,
        experience: fields.experience,
        educationCount: fields.education.length,
        education: fields.education,
        checkedAt: fields.checkedAt,
        charge: fields.charge,
        chargeable: fields.chargeable,
    };
}

function rowFromHit(inputUrl: string, body: Record<string, unknown>): Record<string, unknown> {
    const profile = asRecord(body.profile) || {};
    const currentUrl = normalizeUrl(body.linkedinUrl) || normalizeUrl(profile.linkedInUrl) || normalizeUrl(profile.profileUrl);
    const matchType = (textOrNull(body.matchType) || 'none').toLowerCase();
    const recovered = Boolean(currentUrl) && body.hasLinkedIn !== false;
    const experience = recovered ? experienceOf(profile) : [];
    const education = recovered ? educationOf(profile) : [];
    const skills = recovered ? skillsOf(profile) : null;
    const first = textOrNull(body.firstName) || textOrNull(profile.firstName);
    const last = textOrNull(body.lastName) || textOrNull(profile.lastName);
    const consumed = typeof body.creditConsumed === 'number' ? body.creditConsumed : (recovered ? 1 : 0);
    const chargeable = recovered && consumed > 0;
    const currentRole = experience[0] || {};
    return profileRow(inputUrl, {
        currentUrl: recovered ? currentUrl : null,
        result: !recovered ? 'No match, free' : (matchType === 'exact' || matchType === 'confident' ? 'Live profile' : 'Review this match'),
        matchType: recovered ? matchType : 'none',
        fullName: recovered ? (textOrNull(profile.displayName) || [first, last].filter(Boolean).join(' ') || null) : null,
        firstName: recovered ? first : null,
        lastName: recovered ? last : null,
        headline: recovered ? textOrNull(profile.headline) : null,
        jobTitle: recovered ? (textOrNull(body.jobTitle) || textOrNull(currentRole.title)) : null,
        company: recovered ? (textOrNull(body.company) || textOrNull(profile.companyName) || textOrNull(profile.company) || textOrNull(currentRole.company)) : null,
        companyLinkedInUrl: recovered ? textOrNull(currentRole.companyUrl) : null,
        location: recovered ? textOrNull(profile.location) : null,
        connections: recovered ? connectionsOf(profile) : null,
        about: recovered ? textOrNull(profile.summary) : null,
        skills,
        skillsCount: recovered ? (typeof profile.skillsCount === 'number' ? profile.skillsCount : (skills ? skills.split('; ').length : 0)) : null,
        experience,
        education,
        checkedAt: textOrNull(body.checkedAt) || new Date().toISOString(),
        charge: chargeable ? 'Charged' : 'Free',
        chargeable,
    });
}

function emptyRow(inputUrl: string, outcome: Outcome): Record<string, unknown> {
    return profileRow(inputUrl, {
        currentUrl: null,
        result: outcome === 'failed' ? 'Failed' : 'No match, free',
        matchType: 'none',
        fullName: null,
        firstName: null,
        lastName: null,
        headline: null,
        jobTitle: null,
        company: null,
        companyLinkedInUrl: null,
        location: null,
        connections: null,
        about: null,
        skills: null,
        skillsCount: null,
        experience: [],
        education: [],
        checkedAt: new Date().toISOString(),
        charge: 'Free',
        chargeable: false,
    });
}

await Actor.init();
if (!API_BASE || !API_KEY) throw new Error('This copy has no API credentials. Run oday/mawsool-fix-broken-linkedin-urls on Apify, or request a key from Mawsool.');

const input = (await Actor.getInput<Input>()) || {};
const maxUrls = Math.min(Math.max(Number(input.maxUrls ?? 100), 1), HARD_MAX);
const urls = (await collectUrls(input)).slice(0, maxUrls);
if (!urls.length) throw new Error('No LinkedIn profile URLs found. Add old or broken linkedin.com/in/ links, paste a CSV, or upload a file.');

const concurrency = Math.min(Math.max(Number(input.concurrency ?? 10), 1), 20);
const progressId = (input.resumeId || 'auto').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 60) || 'auto';
const saveProgress = urls.length > 20 || !!input.resumeId;
const skipFinished = saveProgress && !input.freshStart && (urls.length > 200 || !!input.resumeId);
const resumeStore = saveProgress
    ? await Actor.openKeyValueStore(input.resumeId ? `mawsool-url-recovery-resume-${progressId}` : 'mawsool-url-recovery-progress-auto')
    : null;

log.info(`Starting ${urls.length} stale LinkedIn URL recovery lookup(s), concurrency=${concurrency}.`);
log.info('Use this on old, stale, or broken URLs. Review every likely match before you replace that URL.');
if (skipFinished) log.info('URLs that already recovered are skipped. Set freshStart to resolve them again.');

let batch = urls;
let deferFailures = urls.length > 1;
let nextIndex = 0;
const deferred: string[] = [];
let processed = 0;
let recovered = 0;
let likely = 0;
let missed = 0;
let failed = 0;
let skipped = 0;
let stop = false;
let consecutiveOutages = 0;

function noteOutcome(message: string | null): void {
    if (!message) {
        consecutiveOutages = 0;
        return;
    }
    const text = message.toLowerCase();
    const outage = text.includes('did not answer') || text.includes('timed out') || text.includes('fetch failed') || text.includes('network') || text.includes('unavailable') || text.includes('429') || text.includes('502') || text.includes('503') || text.includes('504');
    if (!outage) {
        consecutiveOutages = 0;
        return;
    }
    consecutiveOutages += 1;
    if (consecutiveOutages >= 15 && !stop) {
        stop = true;
        log.error('The lookup service looks unavailable. Stopping so finished rows stay saved and the next run can continue.');
    }
}

function publicRow(row: Record<string, unknown>): Record<string, unknown> {
    const { chargeable, ...rest } = row;
    void chargeable;
    return rest;
}

async function worker(): Promise<void> {
    while (!stop) {
        const index = nextIndex++;
        if (index >= batch.length) return;
        const url = batch[index];
        const recordKey = createHash('sha256').update(slugOf(url)).digest('hex');
        if (skipFinished && resumeStore && await resumeStore.getValue(`done-${recordKey}`)) {
            skipped += 1;
            continue;
        }
        try {
            const result = await resolveUrl(url);
            if (result.kind === 'stop') {
                stop = true;
                log.error(result.message);
                return;
            }
            const row = result.kind === 'hit' ? rowFromHit(url, result.body) : emptyRow(url, 'not_found');
            const chargeable = row.chargeable === true;
            const pushed = chargeable
                ? await Actor.pushData(publicRow(row), EVENT)
                : await Actor.pushData(publicRow(row));
            if (pushed?.eventChargeLimitReached) {
                stop = true;
                return;
            }
            if (row.result === 'Live profile' || row.result === 'Review this match') {
                recovered += 1;
                if (row.result === 'Review this match') likely += 1;
                if (resumeStore && chargeable) await resumeStore.setValue(`done-${recordKey}`, { at: new Date().toISOString() });
            } else {
                missed += 1;
            }
            noteOutcome(null);
            processed += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected lookup error';
            noteOutcome(message);
            if (deferFailures && !stop) {
                deferred.push(url);
                log.warning(`Resolve failed and will be retried at the end: ${message}`);
                continue;
            }
            await Actor.pushData(publicRow(emptyRow(url, 'failed')));
            processed += 1;
            failed += 1;
            log.warning(`Failed resolve: ${message}`);
        }
    }
}

async function runBatch(): Promise<void> {
    nextIndex = 0;
    const workers = Math.min(concurrency, batch.length);
    if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
}

await runBatch();
if (deferred.length && !stop) {
    log.info(`Retrying ${deferred.length} resolve(s) that failed on the first pass.`);
    await sleep(3000);
    batch = deferred.splice(0, deferred.length);
    deferFailures = false;
    await runBatch();
}

await Actor.setValue('OUTPUT', {
    requested: urls.length,
    processed,
    recovered,
    likelyNeedsReview: likely,
    missed,
    failed,
    skipped,
    stoppedByChargeLimit: stop,
});

if (likely > 0) {
    log.warning(`${likely} recovered row(s) are matchType likely. Review the name, company, and title before you replace those URLs.`);
}
log.info(`Finished. Processed=${processed}, recovered=${recovered}, likely=${likely}, missed=${missed}, failed=${failed}, skipped=${skipped}`);
await Actor.exit();
