/**
 * CSE Curriculum Content Roadmap — based on actual student transcript
 *
 * Rebuilt from real semester data. All subject codes and names match
 * the actual university courses taken across 6 semesters (2023-2026).
 */

const ALL_SEMESTERS = [
  {
    semester: "I", year: "DEC 2023",
    subjects: [
      { code: "CSE101", name: "Fundamentals of Computing and Programming in C", credits: 4, grade: "O" },
      { code: "AEC101", name: "Art of Listening, Speaking and Reading Skills", credits: 2, grade: "A+" },
      { code: "FIC101", name: "Emerging Technologies", credits: 2, grade: "B+" },
      { code: "FIC103", name: "Calculus for Engineers", credits: 3, grade: "O" },
      { code: "FIC105", name: "Principles of Economics and Management", credits: 3, grade: "A" },
      { code: "SEC101", name: "Analytical Reasoning and Aptitude Skills", credits: 3, grade: "O" },
      { code: "VAC101", name: "Environmental Science", credits: 2, grade: "A+" },
    ],
  },
  {
    semester: "II", year: "MAY 2024",
    subjects: [
      { code: "CSE102", name: "Data Structures", credits: 4, grade: "O" },
      { code: "AEC107", name: "Effective Writing and Presentation Skills", credits: 2, grade: "A+" },
      { code: "FIC102", name: "Engineering Physics", credits: 3, grade: "O" },
      { code: "FIC117", name: "Linear Algebra and Differential Equations", credits: 3, grade: "O" },
      { code: "FIC120", name: "Foundations of Electrical and Electronics Engineering", credits: 3, grade: "O" },
      { code: "SEC103", name: "Entrepreneurial Mindset", credits: 2, grade: "O" },
      { code: "VAC102", name: "Universal Human Values and Ethics", credits: 2, grade: "A+" },
    ],
  },
  {
    semester: "III", year: "DEC 2024",
    subjects: [
      { code: "CSE201", name: "Coding Skills-I", credits: 2, grade: "A+" },
      { code: "CSE202", name: "OOPS with C++", credits: 4, grade: "A+" },
      { code: "CSE203", name: "Discrete Mathematics", credits: 3, grade: "O" },
      { code: "CSE204", name: "Design and Analysis of Algorithms", credits: 4, grade: "O" },
      { code: "CSE207", name: "Digital Electronics", credits: 4, grade: "O" },
      { code: "AEC108", name: "Problem Solving Skills", credits: 2, grade: "A+" },
      { code: "MCE259", name: "Introduction to Robotics", credits: 3, grade: "O" },
    ],
  },
  {
    semester: "IV", year: "MAY 2025",
    subjects: [
      { code: "CSE205", name: "Hands-On with Python", credits: 2, grade: "O" },
      { code: "CSE206", name: "Coding Skills - II", credits: 2, grade: "O" },
      { code: "CSE208", name: "Probability and Statistics", credits: 3, grade: "O" },
      { code: "CSE209", name: "Database Management Systems", credits: 4, grade: "O" },
      { code: "CSE210", name: "Web Technology", credits: 4, grade: "O" },
      { code: "AEC104", name: "Creativity and Critical Thinking Skills", credits: 2, grade: "A+" },
      { code: "MCE242", name: "Mechatronics", credits: 3, grade: "O" },
    ],
  },
  {
    semester: "V", year: "DEC 2025",
    subjects: [
      { code: "CSE301", name: "Computer Networks", credits: 4, grade: "O" },
      { code: "CSE302", name: "Operating Systems", credits: 4, grade: "O" },
      { code: "CSE303", name: "Machine Learning", credits: 4, grade: "O" },
      { code: "CSE305", name: "Computer Organization and Architecture", credits: 4, grade: "O" },
      { code: "CSE309", name: "Advanced Java Programming", credits: 4, grade: "O" },
      { code: "MCE243", name: "AI for Robotics", credits: 3, grade: "O" },
      { code: "SEC162", name: "Generative AI - I", credits: 3, grade: "O" },
    ],
  },
  {
    semester: "VI", year: "MAY 2026",
    subjects: [
      { code: "CSE304", name: "Automata and Compiler Design", credits: 3, grade: "A+" },
      { code: "CSE306", name: "Software Engineering and Project Management", credits: 4, grade: "A+" },
      { code: "CSE423", name: "Natural Language Processing", credits: 3, grade: "A+" },
      { code: "CSE455", name: "Artificial Intelligence", credits: 4, grade: "O" },
      { code: "CSE456", name: "Digital Image Processing", credits: 4, grade: "O" },
      { code: "MCE244", name: "Dynamics and Control", credits: 3, grade: "A+" },
      { code: "SEC176", name: "Generative AI - II", credits: 3, grade: "O" },
    ],
  },
];

const CORE_CSE_SUBJECTS = [
  { code: "CSE101", name: "Fundamentals of Computing and Programming in C", semester: "I", topics: ["C basics", "control structures", "arrays and strings", "functions", "pointers", "structures and unions", "file handling"] },
  { code: "CSE102", name: "Data Structures", semester: "II", topics: ["arrays", "linked lists", "stacks", "queues", "trees", "graphs", "sorting", "searching", "hashing"] },
  { code: "CSE202", name: "OOPS with C++", semester: "III", topics: ["classes and objects", "inheritance", "polymorphism", "encapsulation", "templates", "STL", "exception handling"] },
  { code: "CSE203", name: "Discrete Mathematics", semester: "III", topics: ["set theory", "relations", "functions", "combinatorics", "graph theory", "boolean algebra", "proof techniques"] },
  { code: "CSE204", name: "Design and Analysis of Algorithms", semester: "III", topics: ["asymptotic analysis", "divide and conquer", "greedy algorithms", "dynamic programming", "graph algorithms", "NP-completeness"] },
  { code: "CSE205", name: "Hands-On with Python", semester: "IV", topics: ["python basics", "data types", "control flow", "functions", "OOP", "libraries", "file I/O"] },
  { code: "CSE207", name: "Digital Electronics", semester: "III", topics: ["number systems", "boolean algebra", "logic gates", "combinational circuits", "sequential circuits", "memory"] },
  { code: "CSE208", name: "Probability and Statistics", semester: "IV", topics: ["probability", "random variables", "distributions", "hypothesis testing", "regression", "statistical inference"] },
  { code: "CSE209", name: "Database Management Systems", semester: "IV", topics: ["ER model", "relational model", "SQL", "normalization", "indexing", "transactions", "concurrency"] },
  { code: "CSE210", name: "Web Technology", semester: "IV", topics: ["HTML", "CSS", "JavaScript", "React", "Node.js", "REST APIs", "databases", "deployment"] },
  { code: "CSE301", name: "Computer Networks", semester: "V", topics: ["OSI model", "TCP/IP", "routing", "transport", "application layer", "security"] },
  { code: "CSE302", name: "Operating Systems", semester: "V", topics: ["process management", "CPU scheduling", "synchronization", "deadlocks", "memory management", "file systems", "I/O"] },
  { code: "CSE303", name: "Machine Learning", semester: "V", topics: ["regression", "classification", "clustering", "neural networks", "SVMs", "ensemble", "evaluation"] },
  { code: "CSE304", name: "Automata and Compiler Design", semester: "VI", topics: ["finite automata", "regular languages", "CFGs", "PDA", "turing machines", "lexical analysis", "parsing", "code generation"] },
  { code: "CSE305", name: "Computer Organization and Architecture", semester: "V", topics: ["CPU arch", "memory hierarchy", "pipelining", "cache", "I/O", "instruction sets"] },
  { code: "CSE306", name: "Software Engineering and Project Management", semester: "VI", topics: ["SDLC", "agile", "requirements", "design", "testing", "project management", "DevOps"] },
  { code: "CSE309", name: "Advanced Java Programming", semester: "V", topics: ["collections", "multithreading", "JDBC", "servlets", "Spring Boot", "microservices"] },
  { code: "CSE423", name: "Natural Language Processing", semester: "VI", topics: ["text preprocessing", "language models", "POS tagging", "parsing", "semantics", "transformers", "LLMs"] },
  { code: "CSE455", name: "Artificial Intelligence", semester: "VI", topics: ["search", "game playing", "knowledge representation", "logic", "planning", "probabilistic reasoning"] },
  { code: "CSE456", name: "Digital Image Processing", semester: "VI", topics: ["image fundamentals", "transforms", "filtering", "segmentation", "feature extraction", "recognition"] },
];

const SKILL_ROADMAPS = [
  {
    skill: "Full-Stack Web Development", difficulty: "intermediate", estimatedHours: 120,
    nodes: [
      { title: "HTML5 & CSS3", nodeType: "concept", description: "Semantic HTML, responsive design, CSS frameworks" },
      { title: "JavaScript Deep Dive", nodeType: "concept", description: "ES6+, async/await, closures, DOM manipulation" },
      { title: "React Fundamentals", nodeType: "concept", description: "Components, state, hooks, routing" },
      { title: "Node.js & Express", nodeType: "concept", description: "REST APIs, middleware, authentication" },
      { title: "Database Integration", nodeType: "concept", description: "SQL, NoSQL, ORMs, database design" },
      { title: "Full-Stack Project", nodeType: "milestone", description: "Build and deploy a complete full-stack app" },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  },
  {
    skill: "AI & Machine Learning", difficulty: "intermediate", estimatedHours: 150,
    nodes: [
      { title: "Python for ML", nodeType: "concept", description: "NumPy, Pandas, data cleaning" },
      { title: "Supervised Learning", nodeType: "concept", description: "Regression, classification, model evaluation" },
      { title: "Unsupervised Learning", nodeType: "concept", description: "Clustering, dimensionality reduction" },
      { title: "Deep Learning", nodeType: "concept", description: "Neural networks with PyTorch/TensorFlow" },
      { title: "NLP & LLMs", nodeType: "concept", description: "Transformers, BERT, fine-tuning" },
      { title: "ML Project", nodeType: "milestone", description: "End-to-end ML lifecycle" },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  },
  {
    skill: "Java Full-Stack Development", difficulty: "intermediate", estimatedHours: 100,
    nodes: [
      { title: "Core Java Deep Dive", nodeType: "concept", description: "Collections, streams, multithreading" },
      { title: "Spring Boot", nodeType: "concept", description: "DI, REST, JPA, security" },
      { title: "Microservices", nodeType: "concept", description: "Service discovery, API gateways, event-driven" },
      { title: "DevOps for Java", nodeType: "concept", description: "CI/CD, Docker, Kubernetes" },
      { title: "Java Project", nodeType: "milestone", description: "Build deployable microservice architecture" },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    skill: "Robotics & AI Integration", difficulty: "advanced", estimatedHours: 90,
    nodes: [
      { title: "Robotics Fundamentals", nodeType: "concept", description: "Kinematics, sensors, actuators" },
      { title: "Control Systems", nodeType: "concept", description: "PID control, dynamics, stability" },
      { title: "AI for Robotics", nodeType: "concept", description: "Computer vision, path planning" },
      { title: "ROS Basics", nodeType: "concept", description: "Robot Operating System, simulation" },
      { title: "Robotics Project", nodeType: "milestone", description: "Integrate AI with robotics hardware" },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    skill: "Generative AI", difficulty: "intermediate", estimatedHours: 60,
    nodes: [
      { title: "Prompt Engineering", nodeType: "concept", description: "Zero-shot, few-shot, chain-of-thought" },
      { title: "LLM Architecture", nodeType: "concept", description: "Transformers, attention, context windows" },
      { title: "RAG Systems", nodeType: "concept", description: "Retrieval augmented generation, embeddings" },
      { title: "AI Agents", nodeType: "concept", description: "Tool use, multi-step reasoning, agent workflows" },
      { title: "GenAI Capstone", nodeType: "milestone", description: "Build a production GenAI application" },
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
];

const SUBJECT_CODE_MAP = {};
ALL_SEMESTERS.forEach(function(sem) {
  sem.subjects.forEach(function(subj) {
    SUBJECT_CODE_MAP[subj.code] = subj.name;
  });
});

module.exports = {
  ALL_SEMESTERS,
  CORE_CSE_SUBJECTS,
  SKILL_ROADMAPS,
  SUBJECT_CODE_MAP,
};
