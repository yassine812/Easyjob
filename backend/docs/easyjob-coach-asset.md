# EasyJob dialogue coach

Asset: `web/public/images/coach/easyjob-human-poses.png` (2172 × 724).

Generated with the built-in `image_gen.imagegen` tool. The three panels depict the same fictional adult man greeting, explaining and celebrating. CSS selects a panel and crossfades poses; this is not live video or lip-synced animation. Optional dialogue audio uses the browser's speech synthesis after the user presses Listen.

## Generation prompt

Create a production web character asset: one wide triptych sprite sheet, exactly THREE equal width panels side by side, no gutters. Each panel shows the SAME fictional friendly adult male career coach age 30, olive skin, short dark hair, subtle beard, photorealistic lifelike studio photography, waist-up, wearing a navy blue casual T-SHIRT with crisp white text exactly 'EasyJob' printed across his chest. Panel 1: smiling warmly at viewer and waving hello with right hand. Panel 2: engaged expression, speaking with an open palm explanatory gesture angled slightly toward viewer's right. Panel 3: big natural smile and thumbs up celebrating. Same person, same clothes, same scale, head position and waist framing in all three panels, plenty of headroom, arms contained within each panel. Plain identical deep midnight navy #0b1225 studio backdrop in every panel. Soft flattering professional lighting with subtle cool rim light. This is for a responsive interactive dialogue coach in a web app. Real human anatomy, skin detail, natural hands, NOT cartoon, NOT flat vector, NOT icon, NOT robot. No speech bubbles, no UI, no text other than EasyJob on the shirts. Wide 3:1 aspect ratio.

## Verification

- Five component tests pass: dialogue progression, positive choice, deferred choice, dismissal cleanup, and language level selection/preservation.
- TypeScript check passes.
- The real components were visually checked through a temporary preview route at desktop size and 390 × 844. The preview route was removed after verification.
