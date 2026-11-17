# Cat Cow Testing Plan #

## Types of Testing ##
Developer self-testing: Owen, Hannah, and Selene run the app locally and click through their own features before handing them off.
Design and exploratory testing (Ellie): Ellie clicks through each new page like a real user and checks it against the Figma design and our requirements.
Manual acceptance testing (Amani): Amani checks every requirement ID in Requirements.md. A requirement passes only if the "then" happens exactly as written.
We aren't really writing automated tests or doing load testing, since we're a small team building a small marketplace.

## Process and Schedule ##
Each milestone on our sprint board follows the same cycle:
- Build: Developers build features on their own branches, self-test, and merge to main.
- Day 1: Ellie runs main locally, reviews the new pages, and reports issues.
- Day 2: Amani validates the milestone against its requirements and records Pass or Fail for each ID.
- Day 3: Developers fix issues, the reporter rechecks them, and the team reviews together before starting the next milestone.

For example, the consumer marketplace was due 11/4, Ellie reviewed it 11/5, Amani validated it 11/6, and fixes were done 11/7.

## Test Environments ##
All testing uses the main branch of our GitHub repo (INFO442_GroupA). Developers test their branches on their own computers, and Ellie and Amani run main locally. We check both signed-in and signed-out states, plus empty states like an empty cart. If a page needs data we haven't connected yet, the developer adds mock data so it can still be tested.

## Failure Protocol ##
- Reporting: Bugs that need a code fix go in GitHub Issues with the page, the requirement ID, what was expected vs. what happened, any console error, and a screenshot (for example, /products/1 rendering a blank page). Small design fixes like spacing or colors go in our group chat, grouped by developer and page.
- Assignment: Each issue goes to the developer who built that feature. Selene owns setup, routing, the database, and inventory. Owen owns navigation, Home, Our Mission, listings, and CSV import. Hannah owns product detail, filtering, Farms, and batches.
- Fixing: The developer fixes it by the milestone's fix date and closes the issue or replies in the chat. The person who reported it rechecks it, and it only counts as fixed once they confirm it works.
