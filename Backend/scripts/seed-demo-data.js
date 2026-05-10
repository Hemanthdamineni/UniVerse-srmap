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
  const events = await request("/events");
  for (const event of events.filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  const resources = await request("/lms/resources?query=Demo&limit=50&page=1");
  for (const resource of (resources.items || []).filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/resources/${encodeURIComponent(resource.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  const guides = await request("/lms/guides?includeDrafts=true");
  for (const guide of guides.filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/guides/${encodeURIComponent(guide.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
  }

  const roadmaps = await request("/lms/roadmaps?includeDrafts=true");
  for (const roadmap of roadmaps.filter((item) => String(item.title || "").startsWith("Demo "))) {
    await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}`, { method: "DELETE" }).catch((error) => {
      console.warn(error.message);
    });
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
      title: "Demo HackSRM Innovation Sprint",
      description: "A campus hackathon with product, prototype, and pitch rounds for cross-department teams.",
      category: "Hackathon",
      tags: ["hackathon", "prototype", "innovation"],
      featured: true,
      startAt: iso(14, 4),
      endAt: iso(15, 12),
      registrationDeadline: iso(10, 18),
      cancellationDeadline: iso(11, 18),
      location: {
        physical: "APJ Abdul Kalam Auditorium",
        virtual: "https://meet.example.edu/hacksrm",
        mapUrl: "",
      },
      agenda: [
        { time: "09:30", title: "Problem statement reveal" },
        { time: "14:00", title: "Mentor review" },
        { time: "17:30", title: "Final pitch" },
      ],
      speakers: [{ name: "Dr. Kavya Raman", title: "Innovation Cell Faculty Lead" }],
      prizes: "Winner: Rs. 20,000, Runner-up: Rs. 10,000, Best freshman team: Rs. 5,000",
      rules: "Teams of 2-4. Original work only. Submissions must include a repository and demo video.",
      eligibility: "Open to all SRM AP students.",
      faq: [{ question: "Can first years join?", answer: "Yes, mixed-year teams are encouraged." }],
      competitionConfig: {
        isCompetition: true,
        teamMode: true,
        minTeamSize: 2,
        maxTeamSize: 4,
        rounds: [
          {
            roundId: "round-1",
            title: "Prototype Submission",
            type: "submission",
            startTime: iso(14, 5),
            submissionDeadline: iso(15, 5),
            instructions: "Submit your GitHub repository, architecture note, and a 2 minute demo video.",
            submissionTypes: ["link", "file"],
            evaluationCriteria: [
              { id: "impact", label: "Impact", maxScore: 40 },
              { id: "execution", label: "Execution", maxScore: 40 },
              { id: "clarity", label: "Clarity", maxScore: 20 },
            ],
            shortlistCount: 8,
          },
          {
            roundId: "round-2",
            title: "Final Pitch",
            type: "presentation",
            startTime: iso(15, 8),
            submissionDeadline: iso(15, 10),
            instructions: "Upload final slides and present live to the jury.",
            submissionTypes: ["file", "link"],
            requiresShortlistFromRound: "round-1",
            evaluationCriteria: [
              { id: "story", label: "Story", maxScore: 30 },
              { id: "business", label: "Feasibility", maxScore: 30 },
              { id: "demo", label: "Demo quality", maxScore: 40 },
            ],
          },
        ],
      },
    },
    {
      ...common,
      title: "Demo UI Systems Design Jam",
      description: "A fast-paced design jam focused on accessible dashboards, responsive layouts, and campus workflow UX.",
      category: "Design",
      tags: ["design", "ux", "accessibility"],
      startAt: iso(21, 5),
      endAt: iso(21, 9),
      registrationDeadline: iso(18, 16),
      location: { physical: "Design Studio Lab 2", virtual: "", mapUrl: "" },
      prizes: "Best system thinking, best accessibility pass, and best visual polish certificates.",
      rules: "Bring a laptop. Use any design or frontend tool. Cite external assets.",
      eligibility: "Open to design, CSE, and ECE students.",
    },
    {
      ...common,
      title: "Demo Research Poster Evening",
      description: "A showcase for undergraduate research posters with faculty feedback and peer voting.",
      category: "Research",
      tags: ["research", "poster", "faculty"],
      startAt: iso(30, 10),
      endAt: iso(30, 13),
      registrationDeadline: iso(25, 16),
      location: { physical: "Library Atrium", virtual: "", mapUrl: "" },
      maxCapacity: 120,
      prizes: "Faculty choice and peer choice awards.",
      rules: "Poster size A1. Abstract must be submitted during registration.",
      eligibility: "Open to all undergraduate researchers.",
    },
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

  for (const payload of resourcePayloads) {
    resources.push(
      await request("/lms/resources", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  }

  const guide = await request("/lms/guides", {
    method: "POST",
    body: JSON.stringify({
      title: "Demo Exam Week Survival Guide",
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

  let roadmap = await request("/lms/roadmaps", {
    method: "POST",
    body: JSON.stringify({
      title: "Demo Full Stack Project Roadmap",
      description: "A practical roadmap from API contract to UI polish for campus apps.",
      skill: "Full Stack Development",
      difficulty: "intermediate",
      estimatedHours: 18,
      published: true,
    }),
  });

  roadmap = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/nodes`, {
    method: "POST",
    body: JSON.stringify({
      title: "Define the API contract",
      description: "List routes, payloads, errors, and auth states before building UI.",
      nodeType: "concept",
    }),
  });
  roadmap = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/nodes`, {
    method: "POST",
    body: JSON.stringify({
      title: "Build reusable UI states",
      description: "Create loading, empty, error, and success states as shared components.",
      nodeType: "milestone",
    }),
  });
  roadmap = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/nodes`, {
    method: "POST",
    body: JSON.stringify({
      title: "Verify with browser checks",
      description: "Use screenshots, console logs, and API assertions before marking complete.",
      nodeType: "milestone",
    }),
  });

  const [first, second, third] = roadmap.nodes || [];
  if (first && second) {
    roadmap = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/edges`, {
      method: "POST",
      body: JSON.stringify({ fromNodeId: first.id, toNodeId: second.id }),
    });
  }
  if (second && third) {
    roadmap = await request(`/lms/roadmaps/${encodeURIComponent(roadmap.id)}/edges`, {
      method: "POST",
      body: JSON.stringify({ fromNodeId: second.id, toNodeId: third.id }),
    });
  }

  const requestBoardItem = await request("/lms/requests", {
    method: "POST",
    body: JSON.stringify({
      title: "Demo Need solved PYQs for Compiler Design",
      description: "Looking for annotated 2024 PYQs with parser construction steps and common mistakes.",
      subjectCode: "CSE310",
      subjectName: "Compiler Design",
      semester: "VI",
      unit: "Unit 2",
      resourceType: "pyq",
    }),
  });

  const collection = await request("/lms/collections", {
    method: "POST",
    body: JSON.stringify({
      name: "Demo Exam Prep Pack",
      description: "Temporary seeded collection for checking collection UI.",
      isPublic: true,
    }),
  });

  for (const resource of resources.slice(0, 2)) {
    await request(`/lms/collections/${encodeURIComponent(collection.id)}/items`, {
      method: "POST",
      body: JSON.stringify({ resourceId: resource.id }),
    }).catch((error) => console.warn(error.message));
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
