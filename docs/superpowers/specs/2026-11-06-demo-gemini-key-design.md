# Demo Gemini key design

## Intent

Allow an evaluator to configure their own Gemini API key from the login screen, so the live demonstration works without editing `.env` or source code.

## Goals

- Keep the configuration optional: the server environment key remains the fallback.
- Put the compact configuration card below the demonstration-access copy on the login screen.
- Use the submitted key only for the current browser session, without persisting it to Prisma, source control, or the browser.
- Make it possible to submit the key before login, then use it for that user's live consultation.

## Non-goals

- This is not account-level key management or a production secret vault.
- The browser never receives the stored key back, and the UI never displays it after submission.
- Fixture consultation and the standalone smoke commands keep their existing behavior.

## Chosen approach

The login page posts the optional key to a dedicated endpoint. The API keeps it in an in-memory store referenced by an HttpOnly temporary cookie. On successful login, the key moves to the newly issued authenticated session and the temporary reference is cleared. The consultation controller reads the authenticated session's temporary key and passes it only to the live Mastra engine; otherwise the engine continues to use `GOOGLE_API_KEY` from the environment.

This adds one small pre-login request, but matches the approved visual proposal's explicit “Usar chave nesta sessão” action and avoids saving the key in `sessionStorage`, a database, or source code.

## Acceptance

- A person can submit a non-empty API key from the login screen and receives a confirmation without the key being rendered.
- The same browser can log in and its live consultation receives that temporary key; an environment key is used when no temporary key exists.
- Logout clears the authenticated session's key; process restart also clears all temporary keys.
- Empty or oversized key submissions are rejected, and key values never appear in API responses, logs, or browser tests.
- Desktop and narrow login layouts retain usable, keyboard-accessible controls.

