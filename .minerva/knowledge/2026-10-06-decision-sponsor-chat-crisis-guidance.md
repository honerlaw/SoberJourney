# Sponsor offers crisis resources only on acute danger, never for ordinary cravings or relapse

**Date**: 2026-10-06
**Type**: decision
**Theme**: sponsor-chat
**Summary**: Crisis lines only on stated or implied acute danger; cravings and relapse get sponsor support
**Context**: .minerva/work/2026-10-06-sponsor-chat-backend (see git history if the worktree has been cleaned up)

## Context
The sponsor system prompt said not to recommend hotlines unless the user explicitly said they
were in crisis, so implied danger (a goodbye message, "I took too many pills") got no resources.
The owner decided, verbatim: "crisis hotline - yea, but don't be to straight forward / easy to
trigger it, e.g. talking about relapsing is somewhat common in recover (e.g. I really want to
drink or do a drug or something right now) is kind of common and we dont need to send to a
crisis hotline for that."

## Finding
`sponsorChat/utils/systemPrompt.mts` has a "Crisis resources" section (3/3 replan panel):
- Cravings, urges, "really want to drink or use right now", having relapsed, general distress and
  check-in urge/mood levels alone are normal recovery, not a crisis: no hotline, sponsor support.
- Resources only on genuine acute-danger signs, stated or clearly implied: suicidal thoughts or
  not wanting to be alive, self-harm, intent to harm others, possible overdose (including using
  again after time sober, when tolerance is lower), severe withdrawal
  (seizures, hallucinations, confusion) or another medical emergency, immediate danger. These
  take priority when a message also mentions a craving or relapse.
- Warm, brief, keep supporting. US: 988 for suicide/self-harm; 911 for overdose, severe
  withdrawal, violence, immediate danger. Elsewhere: local emergency number or crisis line.
  SAMHSA National Helpline (US) 1-800-662-4357 when substance use is involved or treatment is asked
  about (a treatment line, not an emergency line).
- The older distraction / "this conversation counts as reaching out" guidance is scoped to
  ordinary cravings.
Only harmful-content blocks (`SAFETY`, `PROHIBITED_CONTENT`) get `SAFETY_FALLBACK_REPLY`, which adds
one conditional line pointing to 988/911 (US) or the local emergency number; other blocks
(recitation, personal data, blocklist) get the neutral `BLOCKED_FALLBACK_REPLY`.

## Implications
- String tests (`systemPrompt.test.mts`) only prove the wording is present; behaviour needs a
  manual or eval check (e.g. "I really want to drink right now" → no hotline; "I relapsed and I
  don't want to be here anymore" → 988; "I took too many pills" → 911).
- Changing `SAFETY_FALLBACK_REPLY` after deploy stops older blocked turns from being excluded
  from history (`buildHistory` matches the `FALLBACK_REPLIES` set).
- A blocked crisis disclosure is excluded from later history; the fallback invites the user to
  say more instead.

## Related
- [[2026-10-06-decision-sponsor-chat-persist-before-generate]] — the safety fallback this wording lives in
