@api @posts
Feature: POST /posts — boundary and invalid data handling
  Target: JSONPlaceholder (API_BASE_URL in config/env/*.env)

  Objective: the API must handle boundary and invalid data during post creation
  without server-side failures, and should reject invalid input with a 4xx and an
  error message.

  JSONPlaceholder is a mock that does not validate input, so the scenarios are split:
    * untagged  — behaviour that MUST hold (no 5xx, data integrity). Gate the build.
    * @known-issue — the contract the spec asks for. These currently FAIL and are
      reported as defects (see README "Defects found"). Run with: npm run test:known-issues

  Scenario: Valid post is created (positive control)
    Given I have a post payload with a valid post
    When I submit the post
    Then the response status should be 201
    And the response should echo the submitted fields with a new id
    And the response should arrive within the configured time limit

  Scenario Outline: Server stays healthy for a payload with <payload>
    Given I have a post payload with <payload>
    When I submit the post
    Then the API should not fail with a server error
    And the response body should be valid JSON
    And the response should arrive within the configured time limit

    Examples: Excessively long strings
      | payload                     |
      | a 10,000 character title    |
      | a 100,000 character title   |
      | a 1,000,000 character title |

    Examples: Unsupported special characters
      | payload                                                  |
      | an HTML script tag in the title                          |
      | a SQL injection string in the title                      |
      | control characters in the title                          |
      | emoji and right-to-left override characters in the title |

    Examples: Missing required fields and wrong types
      | payload                           |
      | no userId                         |
      | no title                          |
      | an empty object                   |
      | a non-numeric userId              |
      | a JSON array instead of an object |

  Scenario Outline: Title with <payload> is stored without truncation or corruption
    Given I have a post payload with <payload>
    When I submit the post
    Then the title in the response should be identical to the title I sent

    Examples:
      | payload                                                  |
      | a 100,000 character title                                |
      | an HTML script tag in the title                          |
      | emoji and right-to-left override characters in the title |

  @known-issue @DEF-001
  Scenario Outline: Invalid payload is rejected with a client error — <payload>
    Given I have a post payload with <payload>
    When I submit the post
    Then the response status should be 400
    And the response should contain a validation error message

    Examples:
      | payload                           |
      | no userId                         |
      | no title                          |
      | an empty object                   |
      | a non-numeric userId              |
      | a JSON array instead of an object |
      | control characters in the title   |

  @known-issue @DEF-002
  Scenario: Oversized title is rejected as too large
    Given I have a post payload with a 1,000,000 character title
    When I submit the post
    Then the response status should be one of 400, 413 or 422
    And the response should contain a validation error message

  @known-issue @DEF-003
  Scenario Outline: Unparseable body returns a client error, not a server crash — <payload>
    Given I have a post payload with <payload>
    When I submit the post
    Then the API should not fail with a server error
    And the response status should be 400
    And the response should not expose internal implementation details

    Examples:
      | payload             |
      | malformed JSON      |
      | invalid UTF-8 bytes |
