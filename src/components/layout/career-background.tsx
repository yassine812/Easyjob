/** Decorative career network; CSS motion keeps it independent of app loading. */
export function CareerBackground() {
  return (
    <div className="career-background" aria-hidden="true">
      <div className="career-background__glow career-background__glow--indigo" />
      <div className="career-background__glow career-background__glow--teal" />
      <div className="career-background__grid" />
      <svg className="career-background__network" viewBox="0 0 1600 1000" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="career-background__links">
          <path d="M-80 340 C100 340 100 180 280 180 S450 70 520-60 M280 180 C410 180 380 390 520 390 M280 180 C160 340 80 540 160 720 S390 860 470 1060" />
          <path d="M1710 120 C1490 100 1510 280 1350 280 S1230 80 1080-70 M1350 280 C1240 400 1500 530 1390 700 S1100 810 1150 1050 M1390 700 C1540 730 1600 620 1700 640" />
          <path d="M160 720 C340 670 360 800 530 810 M1390 700 C1220 650 1170 600 1050 640" />
        </g>
        <g className="career-background__signals">
          <path d="M-80 340 C100 340 100 180 280 180 S450 70 520-60" />
          <path d="M1350 280 C1240 400 1500 530 1390 700 S1100 810 1150 1050" />
          <path d="M280 180 C160 340 80 540 160 720 S390 860 470 1060" />
        </g>
        <g className="career-background__dots">
          <circle cx="520" cy="390" r="5" /><circle cx="530" cy="810" r="5" />
          <circle cx="1050" cy="640" r="5" /><circle cx="280" cy="180" r="6" />
          <circle cx="1390" cy="700" r="6" /><circle cx="1350" cy="280" r="6" />
        </g>
        <g transform="translate(194 87)">
          <g className="career-background__tile career-background__tile--resume">
            <rect width="94" height="118" rx="18" />
            <g className="career-background__icon">
              <circle cx="31" cy="33" r="9" /><path d="M17 57 C17 41 45 41 45 57 M58 27h18 M58 39h12 M20 77h54 M20 90h37" />
            </g>
          </g>
        </g>
        <g transform="translate(1302 206)">
          <g className="career-background__tile career-background__tile--job">
            <rect width="104" height="88" rx="22" />
            <g className="career-background__icon">
              <rect x="23" y="32" width="58" height="36" rx="6" />
              <path d="M40 32v-9h24v9 M23 45q29 15 58 0 M49 46h6v10h-6z" />
            </g>
          </g>
        </g>
        <g transform="translate(106 670)">
          <g className="career-background__tile career-background__tile--match">
            <rect width="100" height="100" rx="26" />
            <g className="career-background__icon">
              <circle cx="50" cy="50" r="27" /><path d="m36 50 10 10 20-22" />
            </g>
          </g>
        </g>
        <g transform="translate(1352 672)">
          <g className="career-background__tile career-background__tile--spark">
            <rect width="78" height="78" rx="22" />
            <path className="career-background__icon" d="m39 17 6 16 16 6-16 6-6 16-6-16-16-6 16-6z" />
          </g>
        </g>
      </svg>
    </div>
  );
}
