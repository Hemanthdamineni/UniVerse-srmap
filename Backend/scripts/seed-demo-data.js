const API_BASE = process.env.API_BASE || "http://127.0.0.1:5000/api";
const DEMO_REG_NO = process.env.DEMO_REG_NO || "AP23110010419";

const state = {
  sessionId: "",
};

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.sessionId ? { Cookie: `erp_session=${state.sessionId}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${text}`);
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "success" in payload &&
    "data" in payload
  ) {
    return payload.data;
  }

  return payload;
}

async function login() {
  const response = await request("/dev/login", {
    method: "POST",
    body: JSON.stringify({ username: DEMO_REG_NO }),
  });
  state.sessionId = response.sessionId;
  return response;
}

function iso(offsetDays, hour = 10, minute = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function cleanupDemoData() {
  // Clean up events
  const events = await request("/events");
  for (const event of events) {
    await request(`/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  // Clean up resources (with pagination)
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const resources = await request(`/lms/resources?query=Demo&limit=100&page=${page}`);
    const demoResources = (resources.items || []).filter((item) => String(item.title || "").startsWith("Demo "));
    for (const resource of demoResources) {
      await request(`/lms/resources/${encodeURIComponent(resource.id)}`, { method: "DELETE" }).catch((error) => {
        console.warn(error.message);
      });
    }
    hasMore = demoResources.length === 100 && resources.pagination?.page < resources.pagination?.totalPages;
    page++;
  }

  // Clean up guides (listGuides returns array directly)
  const guides = await request("/lms/guides?includeDrafts=true");
  for (const guide of (Array.isArray(guides) ? guides : []).filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/guides/${encodeURIComponent(guide.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  // Clean up roadmaps (listRoadmaps returns array directly)
  const roadmaps = await request("/lms/roadmaps?includeDrafts=true");
  for (const roadmap of (Array.isArray(roadmaps) ? roadmaps : []).filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  // Clean up requests (getRequests returns { items, pagination })
  const requestsResponse = await request("/lms/requests?includeDrafts=true");
  const requests = requestsResponse?.items || [];
  for (const req of requests.filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/requests/${encodeURIComponent(req.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  // Clean up collections (listCollections returns array directly; no DELETE endpoint for collections)
  const collections = await request("/lms/collections?includeDrafts=true");
  for (const col of (Array.isArray(collections) ? collections : []).filter((item) => String(item.name || "").startsWith("Demo "))) {
    // Get collection with items (items are embedded in the collection response)
    const collectionWithItems = await request(`/lms/collections/${encodeURIComponent(col.id)}`).catch(() => null);
    const items = collectionWithItems?.items || [];
    for (const item of items) {
      await request(`/lms/collections/${encodeURIComponent(col.id)}/items/${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch((error) => {
        console.warn(error.message);
      });
    }
    // Note: Collection DELETE not supported by API; collections remain but emptied
  }
}

async function seedEvents() {
  const common = {
    organizer: "SRM AP Student Affairs",
    department: "Computer Science and Engineering",
    visibility: "public",
    status: "published",
    maxCapacity: 240,
    coOrganizers: ["AP23110010001", "AP23110010002"],
    registrationFormFields: [
      { id: "portfolio", label: "Portfolio or GitHub link", type: "url", required: false },
      { id: "dietary", label: "Dietary preference", type: "text", required: false },
    ],
  };

  const payloads = [
    {
      ...common,
      title: "InnovateSRM Hackathon 2.0",
      description: "The premier university hackathon challenging students to build scalable solutions for real-world problems. Participants will work in teams, receive mentorship from industry leaders, and compete for massive cash prizes.",
      category: "Hackathon",
      tags: ["hackathon", "prototype", "innovation", "coding"],
      featured: true,
      startAt: iso(14, 9),
      endAt: iso(16, 18),
      registrationDeadline: iso(10, 23),
      cancellationDeadline: iso(12, 18),
      location: {
        physical: "Main Campus Auditorium",
        virtual: "https://discord.gg/innovatesrm",
        mapUrl: "",
      },
      agenda: [
        { time: "09:00", title: "Registration & Breakfast" },
        { time: "10:30", title: "Opening Ceremony & Problem Statement Reveal" },
        { time: "12:00", title: "Hacking Begins" },
        { time: "20:00", title: "Mentor Review - Checkpoint 1" },
        { time: "08:00 (Next Day)", title: "Mentor Review - Checkpoint 2" },
        { time: "16:00 (Next Day)", title: "Submissions Close & Pitching Begins" },
      ],
      speakers: [
        { name: "Dr. Kavya Raman", title: "Innovation Cell Faculty Lead" },
        { name: "Arjun Mehta", title: "CTO, TechCorp India (Chief Guest)" },
      ],
      prizes: "1st Prize: ₹50,000 | 2nd Prize: ₹30,000 | 3rd Prize: ₹15,000. All finalists get cloud credits and swag.",
      rules: "1. Teams must have 2 to 4 members.\n2. All code must be written during the hackathon.\n3. Plagiarism leads to immediate disqualification.\n4. Decisions made by judges are final.",
      eligibility: "Open to all currently enrolled undergraduate and postgraduate students of SRM AP.",
      faq: [
        { question: "Can I participate if I don't have a team?", answer: "Yes! We will host a team-building session right before the event starts." },
        { question: "Are hardware projects allowed?", answer: "Yes, but you must bring your own components." },
      ],
      competitionConfig: {
        isCompetition: true,
        submissionScope: "team",
        teamMode: true,
        minTeamSize: 2,
        maxTeamSize: 4,
        rounds: [
          {
            roundId: "round-1",
            title: "Ideation & Architecture",
            type: "submission",
            startTime: iso(14, 12),
            submissionDeadline: iso(14, 18),
            instructions: "Submit a 2-page PDF detailing your project idea, architecture diagram, and tech stack.",
            submissionTypes: ["file", "link"],
            maxFileSizeMb: 10,
            maxResubmissions: 2,
            evaluationCriteria: [
              { id: "originality", label: "Originality", maxScore: 30 },
              { id: "feasibility", label: "Technical Feasibility", maxScore: 40 },
              { id: "clarity", label: "Clarity", maxScore: 30 },
            ],
            shortlistCount: 20,
            requiresShortlistFromRound: null,
            resultsPublished: false,
          },
          {
            roundId: "round-2",
            title: "Final Prototype & Pitch",
            type: "presentation",
            startTime: iso(15, 8),
            submissionDeadline: iso(16, 16),
            instructions: "Submit your final GitHub repository link and a 3-minute demo video.",
            submissionTypes: ["link"],
            maxFileSizeMb: 0,
            maxResubmissions: 1,
            requiresShortlistFromRound: "round-1",
            evaluationCriteria: [
              { id: "execution", label: "Execution & Completeness", maxScore: 40 },
              { id: "impact", label: "Impact & Use Case", maxScore: 30 },
              { id: "presentation", label: "Presentation Quality", maxScore: 30 },
            ],
            shortlistCount: null,
            resultsPublished: false,
          },
        ],
      },
    },
    {
      ...common,
      title: "Milan 2026 - National Cultural Fest",
      description: "SRM AP's biggest annual cultural extravaganza! Four days of music, dance, theater, and arts featuring students from across the country and a grand pro-nite concert.",
      category: "Cultural",
      tags: ["fest", "cultural", "dance", "music", "milan"],
      featured: true,
      startAt: iso(45, 16),
      endAt: iso(49, 23),
      registrationDeadline: iso(40, 23),
      cancellationDeadline: iso(42, 18),
      location: { physical: "University Grounds", virtual: "", mapUrl: "" },
      maxCapacity: 5000,
      agenda: [
        { time: "16:00 (Day 1)", title: "Inauguration & Flash Mob" },
        { time: "18:00 (Day 1)", title: "Battle of Bands" },
        { time: "10:00 (Day 2)", title: "Inter-college Dance Competition" },
        { time: "19:00 (Day 4)", title: "Pro-Nite Concert featuring Amit Trivedi" },
      ],
      speakers: [{ name: "Amit Trivedi", title: "Celebrity Singer/Composer" }],
      prizes: "Certificates, Trophies, and Cash Prizes worth ₹2 Lakhs across 30+ sub-events.",
      rules: "1. University ID card is mandatory for entry.\n2. Alcohol and prohibited substances are strictly banned.\n3. Re-entry after 9 PM is not permitted.",
      eligibility: "Open to students from all recognized universities.",
      faq: [{ question: "Are outsiders allowed?", answer: "Yes, provided they have registered online and carry a valid college ID." }],
    },
    {
      ...common,
      title: "CyberSecurity Deep Dive Workshop",
      description: "An intensive, hands-on workshop covering the fundamentals of ethical hacking, web vulnerability scanning, and secure coding practices.",
      category: "Workshop",
      tags: ["cybersecurity", "tech", "workshop", "ethical-hacking"],
      startAt: iso(5, 10),
      endAt: iso(5, 17),
      registrationDeadline: iso(2, 23),
      location: { physical: "Computer Lab 4, Tech Block", virtual: "", mapUrl: "" },
      maxCapacity: 60,
      agenda: [
        { time: "10:00", title: "Introduction to Web Vulnerabilities (OWASP Top 10)" },
        { time: "12:00", title: "Hands-on: SQL Injection & XSS" },
        { time: "14:00", title: "Networking Fundamentals & Nmap" },
        { time: "15:30", title: "Secure Coding Practices" },
      ],
      speakers: [{ name: "Ravi Shankar", title: "Security Researcher, Infosec India" }],
      prizes: "Top 3 performers in the live CTF win exclusive hoodies and a 1-year HackTheBox VIP subscription.",
      rules: "Participants must bring their own laptops with Kali Linux or a similar environment installed. All scanning must be directed only at the provided lab targets.",
      eligibility: "Targeted towards CSE students, but open to all.",
    },
    {
      ...common,
      title: "Annual Undergraduate Research Symposium",
      description: "A formal platform for undergraduate students to present their research findings, network with faculty, and explore future academic opportunities.",
      category: "Research",
      tags: ["research", "symposium", "academic", "paper-presentation"],
      startAt: iso(20, 9),
      endAt: iso(20, 16),
      registrationDeadline: iso(10, 23),
      location: { physical: "Academic Block - Seminar Hall 1", virtual: "", mapUrl: "" },
      maxCapacity: 150,
      agenda: [
        { time: "09:00", title: "Keynote Address: The Future of AI in Research" },
        { time: "10:30", title: "Oral Presentations - Session A (Engineering)" },
        { time: "13:30", title: "Poster Presentations & Networking" },
        { time: "15:00", title: "Award Ceremony" },
      ],
      speakers: [
        { name: "Dr. Ananya Sharma", title: "Dean of Research" },
        { name: "Prof. Vikram Reddy", title: "Guest Speaker from IISc" }
      ],
      prizes: "Best Paper Award (₹10,000) and Best Poster Award (₹5,000).",
      rules: "Submissions must be original research. Presenters are allowed 10 minutes for oral presentations followed by a 5-minute Q&A.",
      eligibility: "Open exclusively to undergraduate researchers at SRM AP.",
      faq: [
        { question: "Can I attend if I'm not presenting?", answer: "Yes, attendance is open to all students and faculty." }
      ],
    },
    {
      ...common,
      title: "Inter-Departmental Sports Meet",
      description: "The ultimate clash of departments! Cheer for your department in basketball, football, volleyball, track and field, and indoor sports.",
      category: "Sports",
      tags: ["sports", "tournament", "athletics"],
      startAt: iso(10, 8),
      endAt: iso(13, 18),
      registrationDeadline: iso(5, 23),
      location: { physical: "University Sports Complex", virtual: "", mapUrl: "" },
      maxCapacity: 1000,
      agenda: [
        { time: "08:00 (Day 1)", title: "Torch Relay & March Past" },
        { time: "09:30 (Day 1)", title: "Track & Field Heats" },
        { time: "14:00 (Day 2)", title: "Basketball & Football Semi-finals" },
        { time: "16:00 (Day 4)", title: "Finals & Trophy Distribution" },
      ],
      rules: "1. Participants can register for a maximum of 3 events.\n2. Standard federation rules apply for all sports.\n3. Referee decisions are final.",
      eligibility: "All students. Teams must be formed strictly within departments.",
    }
  ];

  const created = [];
  for (const payload of payloads) {
    const result = await request("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    created.push(...(Array.isArray(result) ? result : [result]));
  }
  return created;
}

async function seedLms() {
  const resources = [];
  const resourcePayloads = [
    {
      type: "note",
      title: "Demo DSA Pattern Notes for Mid-Sem Revision",
      description: "Concise revision notes covering two pointers, binary search on answer, and graph traversal patterns.",
      difficulty: "intermediate",
      semester: "VI",
      subjectCode: "CSE302",
      subjectName: "Design and Analysis of Algorithms",
      unit: "Unit 3",
      tags: ["dsa", "revision", "midsem"],
      noteContent:
        "1. Identify monotonic constraints before binary-searching an answer.\n2. For graph traversal, write the visited invariant first.\n3. Convert recursion to iterative DFS when stack depth can exceed input limits.",
      renderType: "note",
      validForSemester: "2026 Spring",
    },
    {
      type: "link",
      title: "Demo OS Scheduling Visualizer Reference",
      description: "A reference for comparing FCFS, SJF, priority, and round-robin scheduling traces.",
      difficulty: "beginner",
      semester: "VI",
      subjectCode: "CSE304",
      subjectName: "Operating Systems",
      unit: "Unit 2",
      tags: ["os", "scheduling", "visualizer"],
      url: "https://www.geeksforgeeks.org/cpu-scheduling-in-operating-systems/",
      renderType: "link",
      validForSemester: "2026 Spring",
    },
    {
      type: "quiz",
      title: "Demo DBMS Normalization Quick Quiz",
      description: "Practice quiz for keys, dependencies, and normal forms.",
      difficulty: "intermediate",
      semester: "VI",
      subjectCode: "CSE306",
      subjectName: "Database Management Systems",
      unit: "Unit 4",
      tags: ["dbms", "normalization", "quiz"],
      structuredContent: {
        questions: [
          {
            id: "q1",
            question: "Which normal form removes transitive dependency?",
            options: ["1NF", "2NF", "3NF", "BCNF"],
            correctIndex: 2,
            explanation: "3NF removes transitive dependency for non-prime attributes.",
          },
          {
            id: "q2",
            question: "A candidate key must be unique and...",
            options: ["nullable", "minimal", "composite", "indexed"],
            correctIndex: 1,
            explanation: "Candidate keys are minimal superkeys.",
          },
        ],
      },
      renderType: "quiz",
      validForSemester: "2026 Spring",
    },
    {
      type: "flashcard",
      title: "Demo Computer Networks Flashcards",
      description: "Flashcards for transport-layer and routing fundamentals.",
      difficulty: "beginner",
      semester: "VI",
      subjectCode: "CSE308",
      subjectName: "Computer Networks",
      unit: "Unit 1",
      tags: ["networks", "flashcards", "tcp"],
      structuredContent: {
        cards: [
          { front: "TCP", back: "Connection-oriented transport protocol with reliability and congestion control." },
          { front: "UDP", back: "Connectionless transport protocol with low overhead and no delivery guarantee." },
        ],
      },
      renderType: "flashcards",
      validForSemester: "2026 Spring",
    },
  ];

  // Check if demo resources already exist
  const existingResources = await request("/lms/resources?query=Demo&limit=100&page=1");
  const existingDemoTitles = new Set(
    (existingResources.items || []).filter((item) => String(item.title || "").startsWith("Demo ")).map((item) => item.title)
  );

  for (const payload of resourcePayloads) {
    if (existingDemoTitles.has(payload.title)) {
      console.log(`Skipping existing demo resource: ${payload.title}`);
      continue;
    }
    resources.push(
      await request("/lms/resources", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  }

  // Check if demo guide exists (listGuides returns array directly)
  const guidesResponse = await request("/lms/guides?includeDrafts=true");
  const existingGuides = Array.isArray(guidesResponse) ? guidesResponse : [];
  const guideTitle = "Demo Exam Week Survival Guide";
  let guide = existingGuides.find((item) => item.title === guideTitle);
  if (!guide) {
    guide = await request("/lms/guides", {
      method: "POST",
      body: JSON.stringify({
        title: guideTitle,
        description: "A compact guide for planning revision blocks, PYQ practice, and final-day review.",
        subjectCode: "CSE302",
        subjectName: "Design and Analysis of Algorithms",
        semester: "VI",
        unit: "Exam Prep",
        difficulty: "intermediate",
        tags: ["exam", "planning", "revision"],
        published: true,
        sections: [
          {
            title: "Plan the week",
            content: "Split revision into high-yield units, active recall, and one mixed problem set every day.",
          },
          {
            title: "Use PYQs properly",
            content: "Attempt first, compare second, and note the repeated framing of questions.",
          },
          {
            title: "Final day checklist",
            content: "Only review mistakes, formulas, and two solved examples per pattern.",
          },
        ],
      }),
    });
  }

  // Check if demo roadmap exists (listRoadmaps returns array directly)
  const roadmapsResponse = await request("/lms/roadmaps?includeDrafts=true");
  const existingRoadmaps = Array.isArray(roadmapsResponse) ? roadmapsResponse : [];
  const roadmapTitle = "Demo Full Stack Project Roadmap";
  let roadmap = existingRoadmaps.find((item) => item.title === roadmapTitle);
  if (!roadmap) {
    roadmap = await request("/lms/roadmaps", {
      method: "POST",
      body: JSON.stringify({
        title: roadmapTitle,
        description: "A practical roadmap from API contract to UI polish for campus apps.",
        skill: "Full Stack Development",
        difficulty: "intermediate",
        estimatedHours: 18,
        published: true,
      }),
    });
  }

  // Ensure roadmap nodes exist
  if (roadmap && (!roadmap.nodes || roadmap.nodes.length === 0)) {
    const nodesToAdd = [
      {
        title: "Define the API contract",
        description: "List routes, payloads, errors, and auth states before building UI.",
        nodeType: "concept",
      },
      {
        title: "Build reusable UI states",
        description: "Create loading, empty, error, and success states as shared components.",
        nodeType: "milestone",
      },
      {
        title: "Verify with browser checks",
        description: "Use screenshots, console logs, and API assertions before marking complete.",
        nodeType: "milestone",
      },
    ];

    for (const nodePayload of nodesToAdd) {
      const node = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/nodes`, {
        method: "POST",
        body: JSON.stringify(nodePayload),
      });
      if (!roadmap.nodes) roadmap.nodes = [];
      roadmap.nodes.push(node);
    }

    const [first, second, third] = roadmap.nodes || [];
    if (first && second) {
      await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/edges`, {
        method: "POST",
        body: JSON.stringify({ fromNodeId: first.id, toNodeId: second.id }),
      }).catch((error) => {
        if (error.status !== 409) console.warn(error.message); // Ignore "cycle" error from existing edge
      });
    }
    if (second && third) {
      await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/edges`, {
        method: "POST",
        body: JSON.stringify({ fromNodeId: second.id, toNodeId: third.id }),
      }).catch((error) => {
        if (error.status !== 409) console.warn(error.message); // Ignore "cycle" error from existing edge
      });
    }
  }

  // Check if demo request exists (getRequests returns { items, pagination })
  const requestsResponse = await request("/lms/requests?includeDrafts=true");
  const existingRequests = requestsResponse?.items || [];
  const requestTitle = "Demo Need solved PYQs for Compiler Design";
  let requestBoardItem = existingRequests.find((item) => item.title === requestTitle);
  if (!requestBoardItem) {
    requestBoardItem = await request("/lms/requests", {
      method: "POST",
      body: JSON.stringify({
        title: requestTitle,
        description: "Looking for annotated 2024 PYQs with parser construction steps and common mistakes.",
        subjectCode: "CSE310",
        subjectName: "Compiler Design",
        semester: "VI",
        unit: "Unit 2",
        resourceType: "pyq",
      }),
    });
  }

  // Check if demo collection exists (listCollections returns array directly)
  const collectionsResponse = await request("/lms/collections?includeDrafts=true");
  const existingCollections = Array.isArray(collectionsResponse) ? collectionsResponse : [];
  const collectionName = "Demo Exam Prep Pack";
  let collection = existingCollections.find((item) => item.name === collectionName);
  if (!collection) {
    collection = await request("/lms/collections", {
      method: "POST",
      body: JSON.stringify({
        name: collectionName,
        description: "Temporary seeded collection for checking collection UI.",
        isPublic: true,
      }),
    });
  }

  // Add resources to collection if not already added
  if (collection && resources.length >= 2) {
    for (const resource of resources.slice(0, 2)) {
      const collectionWithItems = await request(`/lms/collections/${encodeURIComponent(collection.id)}`).catch(() => null);
      const existingItems = collectionWithItems?.items || [];
      const alreadyAdded = existingItems.some((item) => item.id === resource.id);
      if (!alreadyAdded) {
        await request(`/lms/collections/${encodeURIComponent(collection.id)}/items`, {
          method: "POST",
          body: JSON.stringify({ resourceId: resource.id }),
        }).catch((error) => console.warn(error.message));
      }
    }
  }

  return { resources, guide, roadmap, requestBoardItem, collection };
}

async function main() {
  const mode = process.argv.includes("--clean") ? "clean" : "seed";
  const auth = await login();
  await cleanupDemoData();

  if (mode === "clean") {
    console.log(JSON.stringify({ sessionId: auth.sessionId, cleaned: true }, null, 2));
    return;
  }

  const events = await seedEvents();
  const lms = await seedLms();
  console.log(
    JSON.stringify(
      {
        sessionId: auth.sessionId,
        events: events.map((event) => ({ id: event.id, title: event.title })),
        lms: {
          resources: lms.resources.map((resource) => ({ id: resource.id, title: resource.title })),
          guide: { id: lms.guide.id, title: lms.guide.title },
          roadmap: {
            id: lms.roadmap.id,
            title: lms.roadmap.title,
            nodes: Array.isArray(lms.roadmap.nodes) ? lms.roadmap.nodes.length : 0,
          },
          request: { id: lms.requestBoardItem.id, title: lms.requestBoardItem.title },
          collection: { id: lms.collection.id, name: lms.collection.name },
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
