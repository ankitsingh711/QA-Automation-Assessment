# Self-healing report

- Generated: 2026-10-27T16:35:49.937Z
- Provider: heuristic (offline)
- Page under test: http://127.0.0.1:3000
- Confidence threshold: 0.55
- Proposed patch (not applied): `reports/self-healing/LegacyDashboardPage.healed.patch`

| Locator | Broken selector | Status | Proposed locator | Confidence |
|---|---|---|---|---|
| `emiValue` | `xpath=/html/body/div[1]/main/div[2]/div[1]/span` | 🩹 healed | `getByTestId('emi-value')` | 1 |
| `calculateButton` | `#btn-calculate` | 🩹 healed | `getByRole('button', { name: 'Calculate', exact: true })` | 1 |
| `totalPaymentValue` | `div.summary-cards > div:nth-child(3) > span.value` | 🩹 healed | `getByTestId('total-payment-value')` | 0.64 |
| `loanAmountInput` | `input[name="principal"]` | 🩹 healed | `getByRole('spinbutton', { name: 'Loan amount (₹)', exact: true })` | 0.78 |
| `homeLoanTab` | `text="Home Loans"` | 🩹 healed | `getByRole('tab', { name: 'Home Loan', exact: true })` | 0.75 |

## `emiValue` — 🩹 healed

**Intent:** The monthly EMI amount shown in the Summary section of the loan dashboard

**Detected failure:** `locator.waitFor: Timeout 2000ms exceeded. Call log:   - waiting for locator('xpath=/html/body/div[1]/main/div[2]/div[1]/span') to be visible`

### Candidate 1: `getByTestId('emi-value')` — accepted

_Matched 7 weighted keyword(s) from the intent/selector against data-testid "emi-value" in "Monthly EMI"._ (confidence 1)

| Gate | Result | Detail |
|---|---|---|
| Resilient strategy (no CSS/XPath/positional) | pass | testid locator |
| Confidence threshold | pass | 1 (min 0.55) |
| Resolves to exactly one element | pass | matched 1 |
| Visible | pass | isVisible() |
| Fingerprint matches "value" | pass | {"tag":"p","role":null,"type":null,"text":"₹33,038"} |
| Anchored to last-known label | pass | card heading "Monthly EMI", expected "Monthly EMI" |
| Behaviour: readable rupee amount | pass | textContent() = ₹33,038 |

## `calculateButton` — 🩹 healed

**Intent:** The button that submits the loan details form and recalculates the EMI

**Detected failure:** `locator.waitFor: Timeout 2000ms exceeded. Call log:   - waiting for locator('#btn-calculate') to be visible`

### Candidate 1: `getByRole('button', { name: 'Calculate', exact: true })` — accepted

_Matched 3 weighted keyword(s) from the intent/selector against button "Calculate"._ (confidence 1)

| Gate | Result | Detail |
|---|---|---|
| Resilient strategy (no CSS/XPath/positional) | pass | role locator |
| Confidence threshold | pass | 1 (min 0.55) |
| Resolves to exactly one element | pass | matched 1 |
| Visible | pass | isVisible() |
| Fingerprint matches "button" | pass | {"tag":"button","role":null,"type":"submit","text":"Calculate"} |
| Behaviour: clickable | pass | click() succeeded |

## `totalPaymentValue` — 🩹 healed

**Intent:** The total payment (principal + interest) amount shown in the Summary section

**Detected failure:** `locator.waitFor: Timeout 2000ms exceeded. Call log:   - waiting for locator('div.summary-cards > div:nth-child(3) > span.value') to be visible`

### Candidate 1: `getByTestId('total-payment-value')` — accepted

_Matched 7 weighted keyword(s) from the intent/selector against data-testid "total-payment-value" in "Total payment"._ (confidence 0.64)

| Gate | Result | Detail |
|---|---|---|
| Resilient strategy (no CSS/XPath/positional) | pass | testid locator |
| Confidence threshold | pass | 0.64 (min 0.55) |
| Resolves to exactly one element | pass | matched 1 |
| Visible | pass | isVisible() |
| Fingerprint matches "value" | pass | {"tag":"p","role":null,"type":null,"text":"₹39,64,522"} |
| Anchored to last-known label | pass | card heading "Total payment", expected "Total payment" |
| Behaviour: readable rupee amount | pass | textContent() = ₹39,64,522 |

## `loanAmountInput` — 🩹 healed

**Intent:** The number input where the user types the loan amount in rupees

**Detected failure:** `locator.waitFor: Timeout 2000ms exceeded. Call log:   - waiting for locator('input[name="principal"]') to be visible`

### Candidate 1: `getByRole('spinbutton', { name: 'Loan amount (₹)', exact: true })` — accepted

_Matched 7 weighted keyword(s) from the intent/selector against spinbutton "Loan amount (₹)"._ (confidence 0.78)

| Gate | Result | Detail |
|---|---|---|
| Resilient strategy (no CSS/XPath/positional) | pass | role locator |
| Confidence threshold | pass | 0.78 (min 0.55) |
| Resolves to exactly one element | pass | matched 1 |
| Visible | pass | isVisible() |
| Fingerprint matches "input" | pass | {"tag":"input","role":null,"type":"number","text":""} |
| Behaviour: accepts input | pass | inputValue() = 3000000 |

## `homeLoanTab` — 🩹 healed

**Intent:** The tab that switches the dashboard to the Home Loan calculator

**Detected failure:** `locator.waitFor: Timeout 2000ms exceeded. Call log:   - waiting for locator('text="Home Loans"') to be visible`

### Candidate 1: `getByRole('tab', { name: 'Home Loan', exact: true })` — accepted

_Matched 9 weighted keyword(s) from the intent/selector against tab "Home Loan"._ (confidence 0.75)

| Gate | Result | Detail |
|---|---|---|
| Resilient strategy (no CSS/XPath/positional) | pass | role locator |
| Confidence threshold | pass | 0.75 (min 0.55) |
| Resolves to exactly one element | pass | matched 1 |
| Visible | pass | isVisible() |
| Fingerprint matches "tab" | pass | {"tag":"button","role":"tab","type":"button","text":"Home Loan"} |
| Behaviour: becomes selected | pass | aria-selected = true |
