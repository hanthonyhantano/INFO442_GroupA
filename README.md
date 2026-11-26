# INFO442_GroupA
## INFO 442 Autumn 2026 | [Link to Notion](https://app.notion.com/p/Info-442-3f36d7d58fb98049a91ace99ad232721?v=3f36d7d58fb980e5b02e000c8d8602b1&source=copy_link)
- PM: Amani Amir
- Product designer: Ellie Marsh
- Devs: Hannah Phanitchob, Owen Perenchio, Selene Khamneian

## Documents:
- [Competitive Analysis](https://app.notion.com/p/Competitive-Analysis-DUE-Oct-13-3f36d7d58fb980dbbbe4d09cc77b3a96)
- [Design & Specifications](https://app.notion.com/p/Design-Specifications-3fe6d7d58fb9807796d2d1f88480afa8)
- [Requirements](https://app.notion.com/p/Final-Requirements-4056d7d58fb980beba2ddf94e4c20b06)
- [Delivery Plan: Github Milestones and Issues](https://app.notion.com/p/Delivery-Plan-Github-Milestones-Issues-4066d7d58fb98060bb8de7db32bb8d9a)

## Quality:
### Accessibility
- The ZIP picker validates input and shows a `role="alert"` message ("Enter a 5-digit ZIP"). This follows WCAG's Success Criterion 3.3.3 Error Suggestion. 
- Errors use `role="alert"` (sign in, apply, Farms and Farm page load errors, cart errors, Batches "Something went wrong"). This follows WCAG's Success Criterion 3.3.1 Error Identification.
- Website passes the [#NoMouse challenge](https://nomouse.org/) :)

### Security
- Producers sign up (`Apply.jsx`) and sign in (`SignIn.jsx`) through Supabase Auth (`signUp`, `signInWithPassword`). Supabase stores passwords as hashes; our own tables never contain passwords.
- Sign-in shows one general error ("Check your email and password") so it doesn't reveal which part was wrong.
- `RequireProducer.jsx` guards every `/producer` page: for example, anonymous shoppers are sent to `/sign-in`

### Responsivity
- The shopper header and producer sidebar collapse into a "Menu" button (`aria-expanded`) on small screens, and the menu closes after you choose a page, showing mobile navigation.
- Layouts use CSS grid and flexbox instead of fixed widths, and photos use `object-fit: cover` so they fill their space without stretching.
- The nav collapses into a menu. On a laptop, Shop, Explore Cuts, Farms, Our Mission, and For Producers sit in one row across the header. A phone is too narrow for that, so a CSS media query hides them behind a Menu button, which changes to Close menu when it's open. The button also announces whether it's open (aria-expanded), so it's accessible too.
- The cow diagram fits the screen. It's an SVG, so it shrinks to the phone's width, with the regions and labels still readable and tappable.
  
## Team Performance Metrics:
<img width="1464" height="666" alt="image" src="https://github.com/user-attachments/assets/368820ce-8744-4d6d-9219-3be4f7217d7a" />
