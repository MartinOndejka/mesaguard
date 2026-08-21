# Contributing

Bug reports and focused pull requests are welcome.

For a new or changed migration rule, include:

1. a link to the official o1js source, changelog, or merged pull request;
2. one positive fixture that should produce a finding;
3. one negative fixture that must not produce that finding;
4. remediation text that does not overstate what the scanner proves.

Run `npm run check` before submitting a pull request. Do not add telemetry, source upload, network access, or target-project execution to a rule without an explicit design discussion.
