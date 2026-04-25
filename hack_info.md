# Big Berlin Hack Hackathon Manual

<aside>
🏆

**>50k€ Price Pool distributed across cash, hardware & credits**

</aside>

## Important Links:

Discord Server - https://discord.gg/brSqTjJVdh

Project Submission Form -

Viral Content Challenge:

Location: :google-maps: [Donaustraße 44, 12043 Berlin](https://maps.app.goo.gl/mKxJ5hJ715cDv6Ju5)

Hosts : :delta:[The Delta Campus](https://thedelta.io/campus/berlin) & :logowhite: [Code University of Applied Sciences](http://code.berlin)

<aside>
📝

Book your 20 min Legal Office Hours slot with [**PXR**](https://pxr.law/en) from 2pm to 4pm  👉  https://forms.techeurope.io/bigberlinhack/office-hours

</aside>

## Agenda

### **Saturday**

10:00 - Door’s Open & Networking

10:30 - Opening & Matchmaking

12:30 - Lunch

18:30 - Dinner

### **Sunday**

12:30 - Lunch

**14:00 - Competition Opt-In Deadline**

15:00 - Announcement of Finalists

15:15 - Finalist Pitches

16:30 - Award Ceremony

## **Competition Rules & Submission Guidelines**

To compete in the hackathon and have your project considered by the jury, all participants must adhere to the following rules and submission requirements. Failure to meet these guidelines may result in disqualification.

---

## **Submission Requirements**

To qualify for the final judging, you must

- **Submit your project by Sunday at 14:00**
- **Be a team of max. 5 people**
- **Use min. 3 partner technologies** (listed under resources)
- **Have created your project newly at this hackathon** (boilerplates are allowed)

### What needs to be submitted

**Project Presentation**

- Record a **2-minute video demo** of your project (using Loom or equivalent platform)
- Your presentation must include:
  - Detailed explanation of your solution
  - Demonstration of key features with a live walkthrough

**Open Source Repository**

- Provide a **public GitHub repository** containing your project's source code
- Your repository must include:
  - Comprehensive **README** with setup and installation instructions
  - Clear documentation of all APIs, frameworks, and tools utilized
  - Sufficient technical documentation to enable thorough jury evaluation

---

## **Competition Mode**

Our hackathon features a **two-stage competition format**, culminating in a **live final presentation** event.

### Stage 1: Pre-Selection

- Build anything aligned with your creative vision - complete freedom of topic choice
- **8 finalist teams (1x per track)** will advance to the Finalist Stage
- Judging criteria: creativity, technical complexity, with bonus points for effective use of partner technologies

### Stage 2: Finalist Stage

- All finalists will showcase their projects **live before the jury and audience**
- Each team delivers a **5-minute presentation**
- After all presentations, the jury will select the **top 3 winners**
- These top 3 teams will be awarded the Finalist Stage Prizes

## Hackathon Tracks, Side Challenges & Prizes

## Tracks

### [**Buena**](https://buena.com/karriere?utm_source=luma) - 🏗️ The Context Engine

**🏆 Track Prize: €2500**

- Challenge

  Property management runs on context. Every ticket, email, and owner question requires knowing a hundred things about one specific building: Who owns it, what the last assembly decided, whether the roof leak is open, who the heating contractor is.

  Today, that context is scattered across ERPs, Gmail, Slack, Google Drive, scanned PDFs, and the head of the property manager who's been there twelve years. AI agents have to crawl all of it for every single task.

  **Your Goal**

  Build an engine that produces a single Context Markdown File per property. That's a living, self-updating document containing every fact an AI agent needs to act. Dense, structured, traced to its source, surgically updated without destroying human edits. Think CLAUDE.md, but for a building, plus it writes itself.

  **Why this is hard**

  1. Schema alignment: "owner" is called Eigentümer, MietEig, Kontakt, or owner depending on the source system. You must resolve identities across ERPs.
  2. Surgical updates: when an new email arrives you can't generate a whole new file. Regenerating the file destroys human edits and burns tokens. You must patch exactly the right section.
  3. Signal vs. noise: 90% of emails are irrelevant. The engine must judge what belongs in the context and what doesn't.

### [**Qontext**](https://qontext.ai/?utm_source=luma) - Turn fragmented company data into a context base AI can operate on

**🏆 Track Prize: 1g real gold bar (1x per member) + private dinner with Qontext**

- Challenge

  Most AI systems still reconstruct company reality at runtime: they pull scattered facts from mail, CRM, policies, tickets, docs, and chat, then hope the prompt is good enough. That does not scale.

  In this track, you do not start with an agent. You start with company data. We provide a simulated enterprise dataset including email, CRM, HR, policy documents, collaboration/workspace data, IT service data, and business records. Your job is to turn that raw company state into a real, inspectable context base AI can work with and collaborate on top of.

  This track starts with unstructured and semi-structured internal company data. It ends with a virtual file system plus graph that makes this company legible to both machines and humans.

  **Your Goal**

  Build a system that turns the dataset into a structured company memory:

  - a virtual file system that documents the business: static data (employees, customers, products), procedural knowledge (processes, SOPs, rules), and trajectory information (tasks, projects, progress)
  - explicit references both inside and outside the graph: links to other files, and links to the underlying source records where the information comes from
  - interface(s) that enable AI systems to efficiently retrieve context and both business users and AI systems to inspect, validate, edit, and extend the company memory

  **Criteria for a strong solution**

  - generalize beyond the provided dataset and data format
  - resolve easy information conflicts automatically and involve humans where ambiguity actually matters
  - preserve provenance at the fact level and update automatically when source facts change

  This is not a challenge about dumping markdown into folders or building a documentation chatbot. It is about designing a context base that is explainable, editable, robust under change, and useful in practice. Involve humans when it matters, and take over their work as much as possible where it does not.

  **Other Product Thoughts**

  - cover both graph construction and retrieval
  - treat the virtual file system as a product surface, not just storage
  - optimize for long-term maintainability by humans and machines

### [**Inca**](https://www.get-inca.com/en?utm_source=luma) - The Human Test

**🏆 Track Prize: AirPod Pros (1x per member)**

- **Challenge**

  Build a phone-based voice agent that handles an inbound claim call and convinces the caller they are speaking to a human.

  This is not judged from the outside. The jury are the callers. Each juror calls your agent, plays a claimant, and casts a blind vote at the end: human or AI.

  To win, your agent must:

  - get more than 50% of jurors to vote human
  - produce complete, high-quality call documentation
  - stay consistent across dialects and background noise — imagine the caller is standing on the highway after a car accident

  The highest human-pass rate wins.

  **What You’ll Build**

  A voice agent that:

  - accepts an inbound call from a juror reporting an accident
  - gathers the core facts needed to open a claim
  - documents the call clearly and completely
  - sounds human enough to cross the >50% human-vote threshold

  **Tech Stack**

  Open stack. Use any model, TTS system, and telephony provider. No proprietary INCA services are required.

  If you need API keys or credits for premium voice, LLM, or telephony tools, **we’ll cover them.**

  What INCA Provides

  - a short brief on what real claims intake calls sound like
  - help with phone number provisioning
  - API keys or credits for premium tools on request
  - a Slack channel with an INCA contact throughout the hackathon

### [**Hera**](https://hera.video/?utm_source=luma) – AI Agents for Video Generation

**🏆 Track Prize: AirPod Pros (1x per member)**

- Challenge

  Generating video is easy. Image models, video models, and LLMs can produce an asset in seconds. The hard part is deciding how the asset looks like.

  Video is always a means to an end. Someone has a product to launch, a concept to explain or a story to tell. The video is how they get there. Picking what belongs in it, the hook, the angle, the pacing, the emphasis, is what separates work that lands from work that doesn't.

  This is where agents come in. To solve a real problem with video, an agent needs opinions. A belief about what makes a product launch feel exciting. A view on what makes a social post worth watching. A stance on how to turn a dense document into something a person wants to sit through. Just generating without opinions produces slop.

  **Your Goal**

  Build a creative agent that generates video or images to solve a specific problem. Start by defining the problem. Then design the agent and its pipeline. The agent should make editorial decisions on its own, guided by beliefs, presets, and tastes you give it. For example:

  - An agent that creates product launch videos good enough to go viral, without the user needing to know how product launches work
  - An agent that produces social content people actually stop scrolling for
  - A pipeline that takes a 30-page PDF and turns it into a digestible explainer video with voice-over that people want to watch

  Use the Hera API or MCP server or bring your own stack.

  **What we're looking for**

  A clear problem. An agent with a defined point of view. A pipeline where you can explain what the agent decides and why. Output that a real person would actually want.

### [Peec AI](http://peec.ai) - 0 -> 1 AI Marketer

**🏆 Track Prize: €2500**

- Challenge

  AI is compressing product, hiring, and even fundraising advantages - distribution becomes the moat. Peec AI tracks how brands appear across LLMs - how visible it is, how it's talked about and how you compare to competitors.

  Participants must use the Peec AI MCP to build something that helps an early-stage brand win distribution against bigger competitors. That can mean AI agents, content machines, lifecycle, launch workflows - or anything else that helps small, early-stage teams close the gap with much bigger teams. Creativity matters.

  All teams will have access to Peec AI test projects built around the brands below.

  **Example brands**

  *Nothing Phone vs Apple & Samsung*
  Design‑first, transparent, AI‑native phones taking on the default choices in smartphones. Build something that helps Nothing dominate attention, trust, and consideration across the channels that matter most.

  *Attio vs Salesforce & HubSpot*
  A modern, flexible CRM for teams that hate traditional CRMs, going up against heavyweight stacks like Salesforce and HubSpot. Build something that helps Attio win more of the market’s mindshare and customer journey, from discovery to conversion to retention.

  *BYD vs Tesla & Legacy Automakers*
  The world’s top EV seller in units, still treated like the outsider brand in many markets. Build something that helps BYD own more of the conversation around EVs in the channels where buyers are making decisions.

  Docs: https://docs.peec.ai/mcp/introduction

### [**Reonic**](https://reonic.com/en-gb/?utm_source=luma) - AI Renewable Designer

**🏆 Track Prize: 2,501€, Reonic care package, team dinner with a founder and team leads**

- Challenge
  Designing renewable energy systems for individual customers is one of the most time-consuming parts of the installation process. Every home is different, and installers spend hours tailoring each proposal. Time that could otherwise be spent on actual installations.

  **Your Goal**

  Build an AI-powered solution that generates renewable energy system designs for residential customers. Given basic project inputs from an installer or customer, the system should propose a complete setup that combines PV, battery storage, and heat pumps as appropriate. The user should be allowed to refine the design afterwards.

  **Use Cases**

  - Quick offer generation — dramatically reduce time-to-quote for installers
  - Design validation — benchmark human-designed systems against an AI-optimized baseline
  - Customer-facing self-service — let homeowners explore options before contacting an installer

  **What Reonic Provides**

  A large dataset of real residential energy systems, including the input conditions (energy demand, electricity price, EV usage, existing heat pump, etc.) and the final designs that were delivered to customers. Your challenge: use this data to train/prompt/engineer an AI system that can reproduce expert design decisions.

### [**telli**](https://www.telli.com/?utm_source=luma) & [**ai-coustics**](https://ai-coustics.com/?utm_source=luma) - 🌆 Voice AI that works in the wild

**🏆 Track Prize: Bose QuietComfort Ultra Headphones**

- **Challenge**

  Voice interfaces are everywhere, but most of them quietly fall apart the moment they leave the lab. They are built and tested in near-perfect acoustic conditions, and that’s rarely what they face in production.

  **Your goal:**

  Build a real-time voice interface that holds up in the real-world. Use the ai-coustics SDK to handle the audio layer and show what becomes possible when your agent can actually hear.
  For the voice agent framework, we recommend starting with LiveKit ([here&#39;s a quickstart plugin](https://github.com/livekit/plugins-ai-coustics-python)) but bring whatever stack you're comfortable with.

  **Some ideas to get you started:**

  - A fitness coach that counts your reps, corrects your form and motivates you out loud, even with loud music blasting in the background
  - A trivia host that hears every player's answer correctly, even when everyone shouts at once
  - A meeting facilitator that tracks the agenda, nudges people back on topic, and logs action items, without falling apart when the room gets chaotic

  **Not sure where to start?**

  You can get started here with the [LiveKit x AI-Coustics plugin](https://github.com/livekit/plugins-ai-coustics-python) and the team will be around all weekend to answer questions.

  **How we'll judge success:**

  We're not just looking for a cool demo. We’d love if you could design your own ‘audio intelligence metric’ whether that's word error rate, task completion under noise or something you invent yourself and show us what it looks like when your agent passes it.

### Wildcard

**🏆 Track Prize:** Qualification for the Finalist Stage (1x)

- Challenge

  Build whatever you want

## Side Challenges

### [Fastino](https://fastino.ai/) - Best use of [Pioneer](https://pioneer.ai/)

**To compete in this challenge you have to:**

- Use [Pioneer](https://pioneer.ai/) in your project
- Confirm in your project submission that you used it
- What they are looking for:
  - Fine-tune a model that outperforms or replaces a general-purpose LLM API call
  - Thoughtful use of Pioneer's features (synthetic data generation, evaluation against frontier models, adaptive inference)
  - Bonus points for the most creative use case of GLiNER2

**🏆 The best use of** [Pioneer](https://pioneer.ai/) **will win:**

- Cash value of Mac Mini (700€)

### [Aikido](https://www.aikido.dev/)- Most Secure Build

**To compete in this challenge you have to:**

- Create an Aikido account (free)
- [Connect your Git system to Aikido](https://help.aikido.dev/code-scanning/connect-your-source-code/connect-github-account-to-aikido)
- Connect the repo of the project you are building during the hackathon
- Take a screenshot of your security report (clearly showing the number and categories of issues)

**🏆 The most secure built will win:**

- 1000€

### [Gradium](https://gradium.ai/) - Best use of [Gradium](https://gradium.ai/)

**To compete in this challenge you have to:**

- Use [Gradium](https://gradium.ai/) in your project
- Confirm in your project submission that you used it

**🏆 The best use of** [Gradium](https://gradium.ai/) **will win:**

- 900k Gradium Credits + Goodie Bag

### [Entire](https://entire.io/) - Best use of [Entire](https://entire.io/)

**To compete in this challenge you have to:**

- Use [Entire](https://entire.io/?utm_source=luma) in your project
- Confirm in your project submission that you used it

**🏆 The best use of** [Entire](https://entire.io/?utm_source=luma) **will win:**

- $1,000 in Apple gift cards, Switch 2, PS5 & XBOX

## Finalist Stage Prizes

### 1st Place

- **🤑🤑🤑 €10k cash 🤑🤑🤑**
- Gemini Credits
- 10k Tavily Credits
- 900k Gradium Credits
- Pioneer Pro plan (1 month)

### 2nd Place

- Gemini Credits
- 5k Tavily Credits
- 600k Gradium Credits
- Pioneer Pro plan (1 month)

### 3rd Place

- Gemini Credits
- 3k Tavily Credits
- 300k Gradium Credits
- Pioneer Pro plan (1 month)

## Resources

### Technology Partners

- [**Google Deepmind](https://deepmind.google/) -** Frontier Multimodal AI Models

  **Temporary Accounts on Site ([How to use them](https://goo.gle/hackathon-account))**
- [**Tavily**](https://www.tavily.com/) - Real-time search, extraction, research, and web crawling through a single, secure API

  - Sign up under [Tavily.com](http://tavily.com/) to receive 1,000 free credits.
  - If you run out of Credits use this code to generate more credits: TVLY-DLEE5IJU
  - Docs: https://docs.tavily.com/welcome
- [**Lovable](http://lovable.dev) -** Create apps and websites by chatting with AI → Code: **COMM-BIG-PVDK**

  **How it works**

  - The code gives access to Pro Plan 1 (100 credits, a $25 value) at no cost.
  - Unlocks all Pro Plan 1 features for the duration of the plan.
  - The code must be redeemed by the end of the event, and should not be shared with anyone outside of the event.

  **How to apply the code**

  1. Go to [lovable.dev](http://lovable.dev/)
  2. If you don't have an account, click on “Get started” → Create an account.
  3. If you have an account, go to Settings → Plans & Credits.
  4. Select Pro Plan 1 (100 credits). Make sure to choose the monthly plan.
  5. At checkout, enter your discount code: **COMM-BIG-PVDK**
- [**Gradium**](https://gradium.ai/) - Voice AI models for realtime interactions

  - Create an account on [gradium.ai](http://gradium.ai)
  - Tell Pratim (on-site) or the team on discord (#gradium) your organization name
  - Check out the API [onboarding docs](https://gradium.ai/api_docs.html).
- [**Entire**](https://entire.io/?utm_source=luma) - Developer platform for agent-human collaboration

  Install tool with commands found here: https://docs.entire.io/cli/installation
- [**Aikido**](https://www.aikido.dev/) - Secure everything, compromise nothing ***(not eligible as one of 3 partner technologies)***

  Participants can log in at [app.aikido.dev/login](http://app.aikido.dev/login) and will automatically receive access to a Pro trial to use throughout the hackathon.
- [**Pioneer](https://pioneer.ai/) by [Fastino](https://fastino.ai/)** - Models that train themselves

  Check out their Big Berlin Hack onboarding page [here](https://www.notion.so/3498413d474480319020ddb593d700c0?pvs=21).

## FAQ

- **Will there be any food available in the venue for free or to buy?**

  Food (lunch and dinner) is provided for all participants free of charge. Snacks and drinks will also be available throughout the hackathon.
- **Do I need to be in a team, or can I participate solo?**

  You can join as a solo hacker or form a team of up to **5 people.** Team matchmaking will happen on Saturday after the opening session.
- **What exactly needs to be submitted?**

  - A **2-minute video demo** (e.g., Loom)
  - A **GitHub repository (public!)** with source code, README, documentation, and setup instructions.
- **Do we need to use the partner technologies?**

  You must use at least 3 **provided technologies** (Google Deepmind, Lovable, Gradium, Entire, Tavily, Aikido, Pioneer by Fastino).
- **Where do I find help and announcements during the hackathon?**

  Join the **Discord server**: https://discord.gg/cMxebncsh – it’s the main place for updates, team finding, and support.
