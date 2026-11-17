# Attobrain design system

## Visual direction

Use the existing Attobrain identity shown in the Figma file `protótipo - ATTObrain`. Keep the product interface light, calm, legible, and focused on participant activity data. The learner view remains a separate, distraction-light experience.

## Tokens

- Brand violet: `#6941C6`; Figma login action violet: `#3928D8`.
- Teal: `#087F73`; login gradient end: `#16AAAD`.
- Ink: `#0F172A`; muted text: `#64748B`; border: `#E2E8F0`.
- Page: `#F6F7FB`; surface: `#FFFFFF`; pale violet: `#F5F3FF`.
- Typeface: Manrope, with system sans-serif fallback.
- Base spacing: 4px increments; cards use 16px radius; controls at least 44px high.

## Login

At desktop widths, use the Figma split composition: a 39% violet-to-teal brand panel on the left and a neutral access area on the right. Place the logo and message on the left; center a 410px access form on the right. Vertically center the form content inside its card. At widths below 840px, stack the brand message above the form. Keep field labels visible, focus rings clear, interactive targets at least 44px high, errors announced, and reduced-motion preferences respected.

## Professional and learner screens

Professional screens use the branded sidebar, clear phase context, compact data panels, and restrained color for status and chart series. Keep charts labeled with units, time ranges, and explicit data quality. Missing or ineligible measurements appear as unavailable or insufficient, never as zero. The learner screen uses the original student module, its original maze colors, and no professional navigation or reports.

## Illustrations and motion

Keep the professional home focused on session setup, student records, and report access. Do not add future-feature panels, concept-art cards, or promotional copy to the work dashboard. Use illustrations only when they help a learner complete a task or help a professional understand a real feature; remove decorative art from charts and reports. The attention-network illustration remains in the educational guide and is not a scan, source map, or participant reading.

The activity path is a software demonstration and EEG is synthetic. Label synthetic signals where they appear, and keep them out of behavioral analysis. Keep chart marks sourced from session records and label units and eligibility separately.

The attention guide separates the literature's dorsal and ventral attention networks from example scalp electrode positions in the 10–20 system. Scalp electrode names describe surface locations; do not imply a one-to-one mapping from an electrode to a cortical source. The guide is educational only, the MVP does not estimate attention, and source-localization limits must remain visible.

Use short one-shot transitions. Do not animate active maze paths, chart data, or sensor states in a way that could be mistaken for a real reading. Respect `prefers-reduced-motion`.

## Interaction and responsive behavior

Use visible focus, semantic headings and labels, 44px minimum action targets, and concise inline errors. Support 320px and wider without horizontal page scrolling. Disable animations and transitions under `prefers-reduced-motion: reduce`.
