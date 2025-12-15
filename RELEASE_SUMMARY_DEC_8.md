# Release Summary: December 8, 2024 - Present

**582 commits** shipped since December 8th, 2024.

## 🎯 Major Features

### Sudoduel+ Premium (4 Phases)
- **Phase 1**: SubscriptionContext, upgrade modal, premium badge, dev toggle, lobby gates
- **Phase 2**: Leaderboard API, LeaderboardScreen, rank calculation, chevron animations, magenta glow
- **Phase 3**: Premium name styling, opponent profiles, premium status sync, `is_premium` column, rating display fixes
- **Phase 4**: W-L-D stats, custom emotes, premium gating, H2H stats with caching fixes
- **IAP**: StoreKit/CdvPurchase integration, polling-based purchase detection, product discovery, simulator detection, StoreKit config, global resolver pattern, store refresh logic
- **AdMob**: Integration with grace period, upgrade CTA, test device config

### Tutorial System
- Foundation, interactive steps, number pad, auto-select cell, Time Management/Win Conditions copy, single tap placement, double-tap prevention (useRef guards), debounce logic, number pad styling match, grid resize prevention, auto-advance fixes (Next buttons), signup integration

### Solo Mode
- Implementation, number pad positioning/touch handling, grid sizing fixes, performance optimizations, background effects

### Social Features
- Friend requests (block when target blocked sender), user blocking (table, matchmaking check), user reporting (backend endpoint, modal integration, match history integration)

### Global Ranking
- Implementation, rank refresh on rating change, calculation improvements, debug logging

### Game UI/UX
- **Number Pad**: Minimal style, larger fonts, full width, instant feedback, stronger haptics, cyan outline, grid fonts +20%
- **Countdown**: 3...2...1...GO implementation, Game Over color effect, animation fixes, grid draw improvements
- **Game Over Modal**: Dramatic transition, DEFEAT styling match, emote background changes
- **Visual Effects**: Premium names, cell feedback/highlighting, shimmer/glows, magenta opponent glow, grid breathing, CSS glows, animated overlay, blob effects, grid opacity (0.06-0.12)
- **Performance**: Pre-warm iOS Haptics (eliminated 2.6s delay), TIME_SYNC optimization, requestIdleCallback fixes, renderer warm-up, CSS breathing (eliminated 20 re-renders/sec), useDeferredValue, remove verbose logs/filters, memoize tutorial steps, startTransition, remove BackgroundEffects during gameplay
- **Haptics**: Victory/defeat feedback, stronger number pad haptics, removed screen shake on victory

### Account Management
- Delete account with confirmation, reports deletion fixes, error handling

### Legal & Compliance
- Privacy Policy/Terms, Notion links, username profanity filter, validator improvements, blocked words

## 🔧 Infrastructure

- Railway deployment fixes, package-lock.json regeneration, TypeScript version fixes, build script updates, dependency fixes, CORS FRONTEND_URL config
- TypeScript/linting fixes, unused import/variable removal, duplicate function fixes, code cleanup
- Performance fixes (console.log removal, floating feedback cleanup), grid animation optimizations, banner logic improvements, matchmaking query fixes (ambiguous user_id), H2H stats caching

## 🐛 Bug Fixes

**Tutorial**: Single-entry completion, number pad sizing/overlap, double-entry (flushSync), double-tap prevention, grid resize prevention, auto-advance timing

**Gameplay**: Grid highlighting during countdown, banner re-triggering, cell border z-index, emote sizing, premium name styling, rating display

**Purchase Flow**: Promise resolution, unsubscribe error removal, ownership detection, product loading detection, polling improvements

**UI/UX**: Settings modal scrollability, Dev Options visibility, premium badge styling, upgrade modal copy, stats copy, remove emoji from Emotes button, spinner size reduction, cancel button positioning

## 📊 Stats
- 582 commits, 8 major features, extensive infrastructure work, hundreds of bug fixes

*Generated from git commit history since December 8, 2024*



