# Employee Initials Avatar Design

**Issue:** [#50](https://github.com/kakahimita/nexo-assist/issues/50), part of #9.

## Intent

Give the signed-in employee a compact, recognizable visual identity in the employee sidebar and make the top-bar availability indicator truthful. The initials avatar follows the requested Gmail-like convention while keeping the real name and e-mail readable beside it. The availability label reports whether the authenticated web app can reach an initialized API, rather than claiming a human-like presence.

## Goals

- Derive the avatar label from the server-provided authenticated user's name.
- Show the first letters of the first and last non-empty name parts in uppercase; use the first letter for a one-part name.
- Keep the avatar decorative because the adjacent text already identifies the user.
- Match the compact circular treatment visible in the V03 reference without storing or requesting profile photos.
- Display "Assistente online" only after the backend readiness endpoint returns its documented ready response.
- Use an explicit unavailable state when the readiness request fails, times out, or returns an invalid response.

## Non-goals

- Profile-photo upload, persistence, colour assignment, image generation, or identity API changes.
- Model-provider availability checks, agent presence counts, analytics, or a promise that every individual request will receive a model response.

## Approaches considered

1. **Small shared initials helper in the employee history feature — chosen.** It makes the transformation easy to test and keeps presentation next to the only current employee-sidebar consumer.
2. Render the full name in a styled circle. This does not meet the requested initials behavior and fails for long names.
3. Add a profile image field to the identity model. This would create storage, validation, and authorization work outside this visual increment.

For availability:

1. **Use the existing backend readiness endpoint (`/api/ready`) — chosen.** It confirms the API and initialized database are available, returns an honest failure otherwise, and does not add a new contract or duplicate service checks.
2. Treat a successful login as online. This becomes stale after the API drops and is therefore misleading.
3. Probe the configured model provider. This would need provider-specific semantics and credentials, and it would still not demonstrate durable human-support availability.

## Implementation outline

Add a pure helper that trims and splits a display name, returning the first letter of the first and last available parts. Render its result in a `span` inside the existing account area, immediately before the unchanged name/e-mail text. Scope CSS to the employee account: a small high-contrast circle that flexes safely on narrow screens. The helper's unit tests cover normal, single-name and whitespace-only input; the browser profile test asserts that the decorative avatar displays `AS` for Ana Souza and that the existing accessible name/email remain visible.

Reuse the health client module to validate `/api/ready` with the contracts' readiness schema. The signed-in layout checks it on mount, cancels the request on unmount, and displays a top-bar status with a green dot and "Assistente online" only for the successful ready response. During the short initial check it displays "Verificando disponibilidade"; failure displays "Assistente indisponível" with a retry action. The status is exposed through text and `role=status`, not colour alone. This status reports API readiness only; it is not a claim about a person or model quota.

## Verification

Run focused helper and health-client tests plus profile/browser tests through a red-green cycle, then the repository's required typecheck, lint, unit, integration, build, and browser checks. Compare desktop and narrow employee-sidebar screenshots with the verified V03/V06 secondary references, documenting the availability definition and any remaining visual differences.
