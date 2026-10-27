@ui @dashboard
Feature: Loan dashboard
  As a prospective borrower
  I want to see my monthly EMI, total interest and repayment split
  So that I understand the real cost of a loan before I take it

  Expected figures are always computed by the test suite's own calculator
  (src/utils/loanCalculator.ts), never read back from the application.

  Background:
    Given I am on the loan dashboard

  @smoke
  Scenario: Dashboard loads with the default home loan figures
    Then the loan dashboard should be displayed
    And the "Home Loan" tab should be selected
    And the summary should show a monthly EMI, total interest and total payment
    And the summary should match my own calculation for the values in the form

  Scenario Outline: EMI for a <loan type> of <amount> at <rate>% over <tenure> years matches an independently computed value
    When I select the "<loan type>" tab
    And I calculate a loan of <amount> rupees at <rate>% for <tenure> years
    Then the monthly EMI should match my independently calculated EMI
    And the total interest and total payment should match my independently calculated values

    Examples:
      | loan type     | amount  | rate | tenure |
      | Home Loan     | 2500000 | 10   | 10     |
      | Home Loan     | 5000000 | 7.5  | 15     |
      | Personal Loan | 1000000 | 12   | 5      |
      | Car Loan      | 750000  | 8.75 | 7      |

  Scenario: Moving the tenure slider recalculates the figures
    When I move the "Loan tenure" slider to 20
    Then the "Loan tenure" input should show 20
    And the summary should match my own calculation for the values in the form

  @chart
  Scenario: Payment breakdown pie chart renders valid, non-zero data
    When I calculate a loan of 2500000 rupees at 10% for 10 years
    Then the payment breakdown pie chart should be visible
    And both pie chart segments should have values greater than zero
    And the principal segment should equal the loan amount
    And the interest segment should equal my independently calculated total interest
    And the pie chart legend should show the same values as the segments

  Scenario Outline: Out-of-range <field> is rejected with a helpful message
    When I calculate a loan of <amount> rupees at <rate>% for <tenure> years
    Then I should see the validation message "<message>"
    And the summary figures should be cleared
    And the pie chart should be replaced by an empty-state message

    Examples:
      | field         | amount  | rate | tenure | message                                                  |
      | loan amount   | 50000   | 10   | 10     | Loan amount must be between ₹1,00,000 and ₹2,00,00,000. |
      | interest rate | 2500000 | 25   | 10     | Interest rate must be between 5% and 20%.                |
      | tenure        | 2500000 | 10   | 0      | Loan tenure must be between 1 year and 30 years.         |
