@ui @self-healing
Feature: Legacy dashboard checks — intentionally broken locators (AI self-healing exercise)
  Every scenario here uses src/pages/legacy/LegacyDashboardPage.ts, whose locators were
  recorded against an older version of the UI and are LEFT BROKEN ON PURPOSE.

  These scenarios are expected to fail. They are excluded from the default run and are
  the input for the self-healing POC (npm run heal). See docs/SELF_HEALING.md.

  Background:
    Given I am on the loan dashboard

  Scenario: Read the monthly EMI through an absolute XPath
    Then the legacy EMI value should show a rupee amount

  Scenario: Recalculate through a removed element id
    When I recalculate using the legacy Calculate button

  Scenario: Read the total payment through a positional CSS chain
    Then the legacy total payment value should show a rupee amount

  Scenario: Enter the loan amount through a renamed form field
    When I enter a loan amount of 3000000 using the legacy loan amount field

  Scenario: Switch loan type through outdated tab copy
    When I select the home loan tab using the legacy tab locator
