@ui @report
Feature: Amortization report
  As a borrower planning my finances
  I want a year-by-year breakdown of my repayments
  So that I can see how much of each year's payments go to interest

  @smoke
  Scenario: Report page loads with its parameter form
    Given I am on the amortization report page
    Then the amortization report page should be displayed
    And no report should be shown until I generate one

  Scenario: Generated report matches my own amortization schedule
    Given I am on the amortization report page
    When I generate a report for a loan of 2500000 rupees at 10% for 10 years starting "2026-03"
    Then the report summary should match my independently calculated values
    And the report should state 120 EMIs closing in "Feb 2036"
    And the schedule should have one row per calendar year of the loan
    And every yearly row should match my independently calculated amortization
    And the balance after the final year should be zero

  @chart
  Scenario: Bar chart shows one bar per year and a tooltip with that year's figures
    Given I am on the amortization report page
    When I generate a report for a loan of 1000000 rupees at 12% for 5 years starting "2026-07"
    Then the yearly bar chart should be visible
    And the bar chart should contain 6 bars
    And every bar should show non-zero principal and interest
    When I hover over the bar for 2028
    Then the tooltip should show the 2028 figures from my independently calculated amortization

  Scenario: Filtering the schedule to a single year shows its monthly instalments
    Given I am on the amortization report page
    When I generate a report for a loan of 5000000 rupees at 7.5% for 15 years starting "2026-01"
    And I filter the schedule to show monthly instalments for 2027
    Then the schedule should list 12 monthly instalments for 2027
    And every monthly row should match my independently calculated instalments
    And the bar for 2027 should be highlighted

  Scenario: Loan details flow from the dashboard into the report
    Given I am on the loan dashboard
    When I calculate a loan of 5000000 rupees at 7.5% for 15 years
    And I open the amortization report from the dashboard
    Then the report form should be prefilled with 5000000 rupees at 7.5% for 15 years
    And the report summary should match my independently calculated values

  Scenario Outline: Invalid report parameters are rejected — <field>
    Given I am on the amortization report page
    When I generate a report for a loan of <amount> rupees at <rate>% for <tenure> years starting "2026-01"
    Then I should see the report error "<message>"
    And no report should be shown until I generate one

    Examples:
      | field         | amount  | rate | tenure | message                                              |
      | loan amount   | 0       | 10   | 10     | Loan amount must be between 10,000 and 10,00,00,000. |
      | interest rate | 2500000 | 45   | 10     | Interest rate must be between 0.1 and 30.            |
      | tenure        | 2500000 | 10   | 31     | Loan tenure must be between 1 and 30.                |
